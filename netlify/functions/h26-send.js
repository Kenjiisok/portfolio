// Netlify Function: recebe o RSVP da página oculta h26.html e envia um e-mail
// via Resend para festahalloween00@gmail.com com nome + número de acompanhantes.
//
// Requer a variável de ambiente RESEND_API_KEY configurada no painel do Netlify
// (Site configuration -> Environment variables). Nunca commitar a chave no repo.
//
// Usa o módulo nativo "https" (em vez de fetch) para não depender da versão
// exata do runtime Node que o Netlify usa por baixo dos panos.

const https = require("https");

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

function sendViaResend(apiKey, emailPayload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(emailPayload);
    const req = https.request(
      {
        hostname: "api.resend.com",
        path: "/emails",
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ statusCode: res.statusCode || 0, body }));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED" }) };
    }

    let payload;
    try {
      const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body || "", "base64").toString("utf8")
        : event.body || "{}";
      payload = JSON.parse(rawBody);
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

    const resendRes = await sendViaResend(apiKey, {
      from: "H-26 <h26@eduardokenji.com>",
      to: [DEST_EMAIL],
      subject,
      html,
    });

    if (resendRes.statusCode < 200 || resendRes.statusCode >= 300) {
      console.error("Resend respondeu com erro:", resendRes.statusCode, resendRes.body);
      return { statusCode: 502, body: JSON.stringify({ ok: false, error: "EMAIL_PROVIDER_ERROR" }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("Erro inesperado na function h26-send:", err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: "UNEXPECTED_ERROR" }) };
  }
};
