// utils/date.js
const TZ = process.env.TZ || "America/Sao_Paulo";

/**
 * Recebe Date | ISO string | datetime('now') do SQLite (YYYY-MM-DD HH:mm:ss)
 * e devolve BR: DD/MM/YYYY HH:mm
 */
function fmtBR(value) {
  if (!value) return "-";

  // Se vier como "2026-02-10 13:20:00" (SQLite), converte pra ISO
  let d;
  if (typeof value === "string") {
    const s = value.trim();

    // SQLite: "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm:ss"
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
      d = new Date(s.replace(" ", "T"));
    } else {
      d = new Date(s);
    }
  } else {
    d = new Date(value);
  }

  if (isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

module.exports = { fmtBR, TZ };
