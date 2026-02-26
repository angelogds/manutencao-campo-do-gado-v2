function listNC(inspecaoId) {
  const ncTable = resolveNCTable();

  // detecta colunas reais da tabela NC (pra não quebrar)
  const ncCols = tableColumns(ncTable);

  // nome do texto da NC pode variar conforme sua tabela
  const ncTextCol =
    ncCols.includes("nao_conformidade") ? "nc.nao_conformidade" :
    ncCols.includes("problema") ? "nc.problema" :
    ncCols.includes("descricao") ? "nc.descricao" :
    "NULL";

  const sql = `
    SELECT
      nc.id,
      nc.inspecao_id,
      nc.equipamento_id,
      nc.data_ocorrencia,
      ${ncTextCol} AS nao_conformidade,
      nc.acao_corretiva,
      nc.acao_preventiva,
      nc.data_correcao,
      nc.os_id,
      e.nome   AS equipamento_nome,
      e.codigo AS equipamento_codigo
    FROM ${ncTable} nc
    LEFT JOIN equipamentos e ON e.id = nc.equipamento_id
    WHERE nc.inspecao_id = ?
    ORDER BY date(nc.data_ocorrencia) DESC, COALESCE(e.nome,'') ASC
  `;

  return db.prepare(sql).all(inspecaoId).map((row) => ({
    ...row,
    item: row.equipamento_codigo || String(row.equipamento_id || "-"),
  }));
}
