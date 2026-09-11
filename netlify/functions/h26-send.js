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

function buildEmailHtml({ nome, acompanhantesNum, status }) {
  const statusColor = status === "CONFIRMADO" ? "#7fd28b" : "#b82929";
  const nomeSafe = escapeHtml(nome);

  const detailCell = (label, value) => `
              <td style="padding:12px 10px 12px 0;border-top:1px solid #2a2a2a;width:50%;vertical-align:top;">
                <div style="color:#85827b;font-size:10px;letter-spacing:1px;margin-bottom:4px;">${label}</div>
                <div style="color:#dedbd2;font-size:14px;">${value}</div>
              </td>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>H-26</title>
</head>
<body style="margin:0;padding:0;background:#050505;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0d0d0d;border:1px solid #2a2a2a;font-family:'Courier New',Courier,monospace;">
        <tr>
          <td style="padding:22px 28px;border-bottom:1px solid #2a2a2a;">
            <div style="color:#b82929;font-size:11px;letter-spacing:2px;margin-bottom:6px;">SISTEMA DE REGISTRO // H26-CORE</div>
            <div style="color:#dedbd2;font-size:22px;font-weight:bold;letter-spacing:3px;">PROJETO H-26</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <div style="color:#85827b;font-size:10px;letter-spacing:1px;margin-bottom:2px;">SUJEITO Nº</div>
            <div style="color:#b82929;font-size:44px;font-weight:bold;line-height:1;margin-bottom:10px;">026</div>
            <div style="color:${statusColor};font-size:15px;font-weight:bold;margin-bottom:26px;">STATUS: ${status}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>${detailCell("NOME", nomeSafe)}${detailCell("ACOMPANHANTES", acompanhantesNum)}</tr>
              <tr>${detailCell("DATA", "14.11.2026")}${detailCell("HORÁRIO", "19H00")}</tr>
              <tr>${detailCell("LOCAL", "Rua Pinto Guedes, 171")}${detailCell("CIDADE", "São Paulo · SP")}</tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;border-top:1px solid #2a2a2a;">
            <span style="color:#6f6c66;font-size:10px;letter-spacing:1px;">H-26 RESEARCH FACILITY · HUMAN TRIAL DIVISION</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function buildEmailText({ nome, acompanhantesNum, status }) {
  return [
    "PROJETO H-26 — SISTEMA DE REGISTRO",
    "",
    `STATUS: ${status}`,
    `NOME: ${nome}`,
    `ACOMPANHANTES: ${acompanhantesNum}`,
    "DATA: 14.11.2026",
    "HORÁRIO: 19H00",
    "LOCAL: Rua Pinto Guedes, 171",
    "CIDADE: São Paulo · SP",
  ].join("\n");
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
    const emailData = { nome, acompanhantesNum, status };

    const resendRes = await sendViaResend(apiKey, {
      from: "H-26 <h26@eduardokenji.com>",
      to: [DEST_EMAIL],
      subject,
      html: buildEmailHtml(emailData),
      text: buildEmailText(emailData),
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
