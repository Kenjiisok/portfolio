// Netlify Function: recebe o RSVP da página oculta h26.html e envia um e-mail
// via Resend para festahalloween00@gmail.com com nome + número de acompanhantes.
//
// Requer a variável de ambiente RESEND_API_KEY configurada no painel do Netlify
// (Site configuration -> Environment variables). Nunca commitar a chave no repo.

const DEST_EMAIL = "festahalloween00@gmail.com";
const MAX_ACOMPANHANTES = 4;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: "INVALID_JSON" }) };
  }

  // honeypot: bots costumam preencher campos escondidos. Se vier preenchido,
  // respondemos como se tivesse dado certo, mas não enviamos nada.
  if (payload.website) {
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  const nomeRaw = typeof payload.nome === "string" ? payload.nome.trim() : "";
  const nome = nomeRaw ? nomeRaw.slice(0, 200) : "SUJEITO NÃO IDENTIFICADO";

  const acompanhantesNum = parseInt(payload.acompanhantes, 10);
  if (Number.isNaN(acompanhantesNum) || acompanhantesNum < 0 || acompanhantesNum > MAX_ACOMPANHANTES) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: "INVALID_ACOMPANHANTES" }) };
  }

  const status = payload.status === "RECUSADO" ? "RECUSADO" : "CONFIRMADO";

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY não configurada no ambiente do Netlify.");
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: "SERVER_NOT_CONFIGURED" }) };
  }

  const subject = `H-26 · Nova ${status === "CONFIRMADO" ? "confirmação" : "recusa"}: ${nome}`;
  const html = `
    <p><strong>Status:</strong> ${escapeHtml(status)}</p>
    <p><strong>Nome:</strong> ${escapeHtml(nome)}</p>
    <p><strong>Acompanhantes:</strong> ${acompanhantesNum}</p>
  `;

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "H-26 <onboarding@resend.dev>",
        to: [DEST_EMAIL],
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text().catch(() => "");
      console.error("Resend respondeu com erro:", resendRes.status, errBody);
      return { statusCode: 502, body: JSON.stringify({ ok: false, error: "EMAIL_PROVIDER_ERROR" }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("Falha ao chamar a API da Resend:", err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: "UNEXPECTED_ERROR" }) };
  }
};
