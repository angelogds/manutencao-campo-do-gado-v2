const db = require("../../database/db");

const { AI_ENABLED, OPENAI_API_KEY, OPENAI_MODEL } = process.env;

const SYSTEM_PROMPT = `Você é o Técnico IA da Manutenção do Campo do Gado, especialista em reciclagem animal (graxaria).
Fale de forma direta, prática e técnica, como um encarregado de manutenção experiente.
Use linguagem simples, evite enrolação e sempre foque em segurança, qualidade e redução de parada.
Sempre responda em português do Brasil.`;

function aiEnabled() {
  return /^(1|true|yes|on)$/i.test(String(AI_ENABLED || "")) && Boolean(OPENAI_API_KEY);
}

async function askAI(req, res) {
  if (!aiEnabled()) {
    return res.json({
      ok: false,
      resposta: "IA desativada no momento. Use o conhecimento técnico dos e-books.",
      code: "AI_DISABLED",
    });
  }

  const { pergunta, equipamento_id, os_id, contexto = "geral" } = req.body || {};

  if (!pergunta || typeof pergunta !== "string" || !pergunta.trim()) {
    return res.status(400).json({ ok: false, resposta: "Informe a pergunta para a IA.", code: "INVALID_INPUT" });
  }

  try {
    let contextoExtra = `Contexto informado: ${contexto}\n`;

    if (equipamento_id) {
      const equip = db.prepare("SELECT nome, setor, tipo FROM equipamentos WHERE id = ?").get(equipamento_id);
      if (equip) {
        contextoExtra += `Equipamento: ${equip.nome} (${equip.setor || "Sem setor"} - ${equip.tipo || "Sem tipo"})\n`;
      }
    }

    if (os_id) {
      const os = db.prepare("SELECT descricao, status FROM os WHERE id = ?").get(os_id);
      if (os) {
        contextoExtra += `OS #${os_id}: ${os.descricao || "Sem descrição"} (status: ${os.status || "n/d"})\n`;
      }
    }

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 450,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `${contextoExtra}\nPergunta: ${pergunta.trim()}\n\nResponda com passos objetivos para executar em campo.`,
          },
        ],
      }),
    });

    const data = await completion.json();
    if (!completion.ok) {
      const errMsg = data?.error?.message || "Erro ao consultar IA.";
      return res.status(502).json({ ok: false, resposta: errMsg, code: "AI_UPSTREAM_ERROR" });
    }

    const resposta = data?.choices?.[0]?.message?.content?.trim();
    if (!resposta) {
      return res.status(502).json({ ok: false, resposta: "A IA não retornou conteúdo.", code: "AI_EMPTY_RESPONSE" });
    }

    return res.json({ ok: true, resposta });
  } catch (err) {
    console.error("[ai.askAI]", err);
    return res.status(500).json({ ok: false, resposta: "Falha interna ao processar sua pergunta.", code: "AI_INTERNAL_ERROR" });
  }
}

async function analisarOS(req, res) {
  if (!aiEnabled()) {
    return res.json({
      ok: false,
      error: "IA está desativada no momento.",
      code: "AI_DISABLED",
    });
  }

  const { equipamento_id, descricao } = req.body || {};
  if (!descricao || typeof descricao !== "string" || !descricao.trim()) {
    return res.status(400).json({
      ok: false,
      error: "Informe a descrição da OS para análise.",
      code: "INVALID_INPUT",
    });
  }

  try {
    let equipamento = "";
    if (equipamento_id) {
      const eq = db.prepare("SELECT nome, setor FROM equipamentos WHERE id = ?").get(equipamento_id);
      if (eq) equipamento = `${eq.nome} - ${eq.setor || "Sem setor"}`;
    }

    const prompt = `Analise esta ordem de serviço da graxaria:

Equipamento: ${equipamento || "Não informado"}
Problema: ${descricao.trim()}

Responda APENAS em formato JSON, sem nenhum texto extra:

{
  "criticidade": "BAIXA | MEDIA | ALTA | CRITICA",
  "diagnostico_inicial": "resumo técnico em uma frase",
  "causa_mais_provavel": "causa principal suspeita",
  "acoes_iniciais": "o que deve ser feito primeiro",
  "tempo_estimado_minutos": número inteiro
}`;

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 300,
        messages: [
          { role: "system", content: "Você é um técnico sênior de manutenção industrial. Responda sempre de forma prática e objetiva." },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await completion.json();
    if (!completion.ok) {
      const errMsg = data?.error?.message || "Erro ao consultar IA.";
      return res.status(502).json({ ok: false, error: errMsg, code: "AI_UPSTREAM_ERROR" });
    }

    const texto = data?.choices?.[0]?.message?.content?.trim();
    if (!texto) {
      return res.status(502).json({
        ok: false,
        error: "A IA não retornou conteúdo para análise.",
        code: "AI_EMPTY_RESPONSE",
      });
    }

    const jsonStart = texto.indexOf("{");
    const jsonEnd = texto.lastIndexOf("}") + 1;
    if (jsonStart < 0 || jsonEnd <= jsonStart) {
      return res.status(502).json({
        ok: false,
        error: "Resposta da IA em formato inválido.",
        code: "AI_INVALID_FORMAT",
      });
    }

    const resultado = JSON.parse(texto.substring(jsonStart, jsonEnd));
    return res.json({ ok: true, resultado });
  } catch (err) {
    console.error("[ai.analisarOS]", err);
    return res.status(500).json({
      ok: false,
      error: "Não consegui analisar com a IA. Tente novamente.",
      code: "AI_ERROR",
    });
  }
}

module.exports = { askAI, analisarOS };
