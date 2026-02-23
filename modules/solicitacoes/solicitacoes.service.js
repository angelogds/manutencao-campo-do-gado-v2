function createSolicitacao({ solicitante, setor, observacao, itens, vinculo, createdBy }) {
  const colsSolic = columnsOf("solicitacoes_compra");
  const createdByCol = resolveCreatedByColumn(colsSolic);
  const createdAtCol = resolveCreatedAtColumn(colsSolic);

  const fields = ["solicitante", "setor", "status", "observacao"];
  const placeholders = ["?", "?", "'aberta'", "?"];
  const values = [solicitante, setor || "MANUTENCAO", observacao || null];

  // ✅ só inclui created_by se existir no banco
  if (createdByCol) {
    fields.push(createdByCol);
    placeholders.push("?");
    values.push(createdBy || null);
  }

  if (createdAtCol) {
    fields.push(createdAtCol);
    placeholders.push("datetime('now')");
  }

  const insertSolicSql = `INSERT INTO solicitacoes_compra (${fields.join(", ")}) VALUES (${placeholders.join(", ")})`;
  const insertSolic = db.prepare(insertSolicSql);

  const itensTbl = resolveItensTableName();
  if (!itensTbl) throw new Error("Tabela de itens da solicitação não encontrada.");

  const vincTbl = resolveVinculosTableName();

  const hasEspecificacao = hasColumn(itensTbl, "especificacao");
  const colsItens = columnsOf(itensTbl);
  const itensCreatedAtCol = resolveCreatedAtColumn(colsItens);

  const insertItem = hasEspecificacao
    ? db.prepare(`
        INSERT INTO ${itensTbl} (solicitacao_id, item_id, descricao, especificacao, quantidade, unidade${itensCreatedAtCol ? `, ${itensCreatedAtCol}` : ""})
        VALUES (?, ?, ?, ?, ?, ?${itensCreatedAtCol ? ", datetime('now')" : ""})
      `)
    : db.prepare(`
        INSERT INTO ${itensTbl} (solicitacao_id, item_id, descricao, quantidade, unidade${itensCreatedAtCol ? `, ${itensCreatedAtCol}` : ""})
        VALUES (?, ?, ?, ?, ?${itensCreatedAtCol ? ", datetime('now')" : ""})
      `);

  const insertVinculo =
    vincTbl
      ? db.prepare(`
          INSERT INTO ${vincTbl} (solicitacao_id, tipo_origem, origem_id, equipamento_id, destino_uso, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `)
      : null;

  return db.transaction(() => {
    const info = insertSolic.run(...values);
    const solicitacaoId = Number(info.lastInsertRowid);

    for (const it of itens || []) {
      if (hasEspecificacao) {
        insertItem.run(
          solicitacaoId,
          it.item_id ? Number(it.item_id) : null,
          String(it.descricao || "").trim(),
          it.especificacao ? String(it.especificacao).trim() : null,
          Number(it.quantidade || 1),
          String(it.unidade || "UN").toUpperCase()
        );
      } else {
        const descricaoComposta = [String(it.descricao || "").trim(), it.especificacao ? String(it.especificacao).trim() : ""]
          .filter(Boolean)
          .join(" • ");

        insertItem.run(
          solicitacaoId,
          it.item_id ? Number(it.item_id) : null,
          descricaoComposta,
          Number(it.quantidade || 1),
          String(it.unidade || "UN").toUpperCase()
        );
      }
    }

    if (insertVinculo) {
      insertVinculo.run(
        solicitacaoId,
        String(vinculo?.tipo_origem || "AVULSA").toUpperCase(),
        vinculo?.origem_id ? Number(vinculo.origem_id) : null,
        vinculo?.equipamento_id ? Number(vinculo.equipamento_id) : null,
        vinculo?.destino_uso ? String(vinculo.destino_uso).trim() : null
      );
    }

    return solicitacaoId;
  })();
}
