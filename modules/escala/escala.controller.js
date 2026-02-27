const fs = require("node:fs");
const path = require("node:path");
const service = require("./escala.service");

const PDFDocument = require("pdfkit");

const PDF_COLORS = {
  green: "#15803d",
  text: "#0f172a",
  muted: "#475569",
  line: "#cbd5e1",
  light: "#f8fafc",
};

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function daysInclusive(start, end) {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  return Math.floor((e - s) / 86400000) + 1;
}

exports.index = (req, res, next) => {
  try {
    res.locals.activeMenu = "escala";

    const date = String(req.query?.date || "").slice(0, 10);
    const alvo = date || isoToday();

    const semana = service.getSemanaPorData(alvo);
    const publicacoes = service.getPublicacoes();

    return res.render("escala/index", {
      title: "Escala",
      alvo,
      semana,
      publicacoes,
      pdfStart: String(req.query?.start || semana?.data_inicio || alvo).slice(0, 10),
      pdfEnd: String(req.query?.end || semana?.data_fim || alvo).slice(0, 10),
    });
  } catch (e) {
    next(e);
  }
};

exports.completa = (req, res, next) => {
  try {
    res.locals.activeMenu = "escala";
    const semanas = service.getEscalaCompletaComTimes();
    return res.render("escala/completa", { title: "Escala Completa", semanas });
  } catch (e) {
    next(e);
  }
};

exports.adicionarRapido = (req, res, next) => {
  try {
    const inicio = String(req.body?.inicio || "").slice(0, 10);
    const fim = String(req.body?.fim || "").slice(0, 10);
    const nome = String(req.body?.nome || "").trim();
    const turno = service.normalizeTurno(req.body?.turno);
    const funcao = service.normalizeFuncao(req.body?.funcao);
    const dateRef = inicio || String(req.body?.date || "").slice(0, 10) || isoToday();

    if (!inicio || !fim) {
      req.flash("error", "Preencha início e fim do período.");
      return res.redirect(`/escala?date=${dateRef}`);
    }
    if (fim < inicio) {
      req.flash("error", "Data final não pode ser menor que data inicial.");
      return res.redirect(`/escala?date=${inicio}`);
    }
    if (!nome) {
      req.flash("error", "Informe o nome do colaborador.");
      return res.redirect(`/escala?date=${inicio}`);
    }
    if (!turno) {
      req.flash("error", "Turno inválido. Use Dia, Noite, Apoio ou Plantão.");
      return res.redirect(`/escala?date=${inicio}`);
    }
    if (!funcao) {
      req.flash("error", "Função inválida. Use Mecânico ou Auxiliar.");
      return res.redirect(`/escala?date=${inicio}`);
    }

    const resultado = service.adicionarRapidoPeriodo({
      inicio,
      fim,
      nome,
      tipo_turno: turno,
      funcao,
    });

    let msg = `Período salvo com sucesso (${resultado.semanasAfetadas} semana(s): ${resultado.inserted} inserção(ões), ${resultado.updated} atualização(ões), ${resultado.ignored} sem alterações).`;
    if (resultado.diasSemSemana > 0) {
      msg += ` ${resultado.diasSemSemana} dia(s) do período não possuem semana cadastrada e foram ignorados.`;
    }

    req.flash("success", msg);
    return res.redirect(`/escala?date=${inicio}`);
  } catch (e) {
    next(e);
  }
};

exports.lancarAusencia = (req, res, next) => {
  try {
    const date = String(req.body?.date || "").slice(0, 10) || isoToday();
    const nome = String(req.body?.nome || "").trim();
    const tipo = String(req.body?.tipo || "").trim().toLowerCase();
    const inicio = String(req.body?.inicio || "").slice(0, 10);
    const fim = String(req.body?.fim || "").slice(0, 10);
    const motivo = String(req.body?.motivo || "").trim();

    if (!nome || !inicio || !fim || !tipo) {
      req.flash("error", "Preencha: Nome, Tipo (folga/atestado), Início e Fim.");
      return res.redirect(`/escala?date=${date}`);
    }

    if (inicio > fim) {
      req.flash("error", "Data início não pode ser maior que data fim.");
      return res.redirect(`/escala?date=${date}`);
    }

    if (tipo !== "folga" && tipo !== "atestado") {
      req.flash("error", "Tipo inválido (use folga ou atestado).");
      return res.redirect(`/escala?date=${date}`);
    }

    service.lancarAusencia({ nome, tipo, inicio, fim, motivo });

    req.flash("success", "Ausência lançada. A semana já vai reconhecer automaticamente.");
    return res.redirect(`/escala?date=${date}`);
  } catch (e) {
    next(e);
  }
};

exports.editarSemana = (req, res, next) => {
  try {
    res.locals.activeMenu = "escala";
    const semanaId = Number(req.params.id);
    const semana = service.getSemanaById(semanaId);
    if (!semana) return res.status(404).send("Semana não encontrada");

    return res.render("escala/editar", { title: "Editar Semana", semana });
  } catch (e) {
    next(e);
  }
};

exports.salvarEdicao = (req, res, next) => {
  try {
    const semanaId = Number(req.params.id);
    const alocacaoId = Number(req.body?.alocacaoId);
    const novoTurno = String(req.body?.novoTurno || "").trim().toLowerCase();

    const tipo_turno =
      novoTurno === "noturno" || novoTurno === "noite" ? "noturno" :
      novoTurno === "diurno" || novoTurno === "dia" ? "diurno" :
      novoTurno === "apoio" ? "apoio" :
      novoTurno === "folga" ? "folga" :
      novoTurno === "plantao" ? "plantao" :
      "";

    if (!alocacaoId || !tipo_turno) {
      req.flash("error", "Dados inválidos para edição.");
      return res.redirect(`/escala/editar/${semanaId}`);
    }

    service.atualizarTurno(alocacaoId, tipo_turno);

    req.flash("success", "Turno atualizado.");
    return res.redirect(`/escala/editar/${semanaId}`);
  } catch (e) {
    next(e);
  }
};

exports.pdfSemanaAtual = (req, res, next) => {
  try {
    const date = String(req.query?.date || "").slice(0, 10) || isoToday();
    const semana = service.getSemanaPorData(date);
    if (!semana) {
      req.flash("error", "Não existe semana cadastrada para esta data.");
      return res.redirect(`/escala?date=${date}`);
    }

    const row = makeRowFromSemana(semana);

    renderEscalaPdf({
      res,
      fileName: `escala-semana-${semana.semana_numero}.pdf`,
      subtitulo: "Escala Semanal",
      periodoLabel: `Período: ${formatDateBr(semana.data_inicio)} a ${formatDateBr(semana.data_fim)}`,
      rows: [row],
    });
  } catch (e) {
    next(e);
  }
};

exports.pdfSemana = (req, res, next) => {
  try {
    const semanaId = Number(req.params.id);
    const semana = service.getSemanaById(semanaId);
    if (!semana) return res.status(404).send("Semana não encontrada");

    const row = makeRowFromSemana(semana);

    doc.pipe(res);

    doc.fontSize(16).text("CAMPO DO GADO - ESCALA SEMANAL", { align: "center" });
    doc.moveDown(0.6);
    doc.fontSize(11).text(`Semana: ${semana.semana_numero}`);
    doc.text(`Período: ${semana.data_inicio} até ${semana.data_fim}`);
    doc.text("Setor: Manutenção");
    doc.moveDown(0.8);

    const linhas = service.getLinhasSemanaComStatus(semanaId);

    doc.fontSize(12).text("Colaboradores da Semana", { underline: true });
    doc.moveDown(0.4);

    linhas.forEach((l) => {
      doc.fontSize(11).text(`${l.nome}  |  ${l.turnoLabel}  |  ${l.funcaoLabel}  |  ${l.statusLabel}`);
    });
  } catch (e) {
    next(e);
  }
};

exports.pdfPeriodo = (req, res, next) => {
  try {
    const start = String(req.query?.start || "").slice(0, 10);
    const end = String(req.query?.end || "").slice(0, 10);
    const dateRef = start || isoToday();

    if (!start || !end) {
      req.flash("error", "Informe início e fim para gerar o PDF por período.");
      return res.redirect(`/escala?date=${dateRef}`);
    }
    if (start > end) {
      req.flash("error", "A data final do PDF não pode ser menor que a inicial.");
      return res.redirect(`/escala?date=${dateRef}`);
    }
    if (daysInclusive(start, end) > 365) {
      req.flash("error", "O PDF por período permite no máximo 365 dias.");
      return res.redirect(`/escala?date=${dateRef}`);
    }

    const linhas = service.getLinhasPeriodo(start, end);

    const doc = new PDFDocument({ margin: 36 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=escala-${start}-ate-${end}.pdf`);
    doc.pipe(res);

    doc.fontSize(16).text("Escala – Período", { align: "center" });
    doc.moveDown(0.4);
    doc.fontSize(11).text(`Período: ${start} até ${end}`);
    doc.text("Setor: Manutenção");
    doc.moveDown(0.8);

    if (!linhas.length) {
      doc.fontSize(11).text("Nenhum registro encontrado para o período informado.");
    } else {
      doc.fontSize(11).text("Data | Colaborador | Turno | Função | Status", { underline: true });
      doc.moveDown(0.3);

      linhas.forEach((l) => {
        if (doc.y > 760) doc.addPage();
        doc.fontSize(10).text(
          `${l.data_inicio} a ${l.data_fim} | ${l.nome} | ${l.turnoLabel} | ${l.funcaoLabel} | ${l.statusLabel}`
        );
      });
    }

    doc.moveDown(1);
    doc.fontSize(9).text(`Gerado em: ${new Date().toISOString()}`, { align: "right" });

    doc.end();
  } catch (e) {
    next(e);
  }
};
