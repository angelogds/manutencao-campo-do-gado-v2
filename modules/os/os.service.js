function createOS({ titulo, descricao, equipamento_id, prioridade, abertura_fotos, opened_by }) {
  // Se o banco estiver com FK legado (users_old), opened_by precisa ser NULL
  const legacyFK = hasLegacyUsersOldFK();

  const openedByNumber = Number(opened_by || 0);
  const openedBy = legacyFK ? null : (openedByNumber || null);

  // ✅ Só exige usuário quando NÃO é legacyFK
  if (!legacyFK && !openedBy) {
    throw new Error("Usuário logado obrigatório para abrir OS.");
  }

  const status = "aberta";
  const now = "datetime('now')";

  const columns = listTableColumns("os");
  const fields = ["titulo", "descricao", "status", "created_at"];
  const placeholders = ["?", "?", "?", now];
  const values = [titulo, descricao, status];

  if (columns.includes("equipamento_id")) {
    fields.push("equipamento_id");
    placeholders.push("?");
    values.push(equipamento_id ? Number(equipamento_id) : null);
  }

  if (columns.includes("prioridade")) {
    fields.push("prioridade");
    placeholders.push("?");
    values.push(prioridade || "normal");
  }

  if (columns.includes("opened_by")) {
    fields.push("opened_by");
    placeholders.push("?");
    values.push(openedBy);
  }

  if (columns.includes("abertura_fotos")) {
    fields.push("abertura_fotos");
    placeholders.push("?");
    values.push(Array.isArray(abertura_fotos) ? JSON.stringify(abertura_fotos) : null);
  }

  const sql = `INSERT INTO os (${fields.join(", ")}) VALUES (${placeholders.join(", ")})`;
  const info = db.prepare(sql).run(...values);

  return Number(info.lastInsertRowid);
}
