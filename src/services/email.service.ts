import { ExternalServiceError } from "../errors/infra/ExternalServiceError.js";

type BrandedEmailContent = {
  subject: string;
  preheader: string;
  heading: string;
  greeting: string;
  paragraphs: string[];
  action?: { label: string; url: string };
};

type SendBrandedEmailInput = BrandedEmailContent & {
  to: string;
  idempotencyKey?: string;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export const isBrandedEmailConfigured = () =>
  Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());

export const emailBrandingConfig = () => {
  const siteUrl = (
    process.env.WEBSITE_DOMAIN ||
    process.env.WEB_URL ||
    "https://canelaenrama.com.ar"
  ).replace(/\/+$/, "");
  const logoUrl = process.env.EMAIL_LOGO_URL?.trim() || "https://canelaenrama.com.ar/favicon.png";
  return { siteUrl, logoUrl };
};

export function renderBrandedEmail(content: BrandedEmailContent, logoUrl: string) {
  const paragraphsHtml = content.paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px;line-height:1.6;color:#51463d;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const actionHtml = content.action
    ? `<p style="margin:28px 0;text-align:center;"><a href="${escapeHtml(content.action.url)}" style="display:inline-block;padding:13px 22px;border-radius:8px;background:#c83b1d;color:#ffffff;text-decoration:none;font-weight:700;">${escapeHtml(content.action.label)}</a></p>`
    : "";
  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f7f3ee;font-family:Arial,Helvetica,sans-serif;color:#302820;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f3ee;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #eee6de;border-radius:12px;">
            <tr>
              <td style="padding:28px 32px 20px;text-align:center;border-bottom:1px solid #f0e9e2;">
                <img src="${escapeHtml(logoUrl)}" width="56" height="56" alt="Canela en Rama" style="display:inline-block;width:56px;height:56px;object-fit:contain;vertical-align:middle;">
                <span style="display:inline-block;margin-left:12px;color:#513c2d;font-size:20px;font-weight:700;vertical-align:middle;">Canela en Rama</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 10px;color:#51463d;">${escapeHtml(content.greeting)}</p>
                <h1 style="margin:0 0 22px;color:#302820;font-size:24px;line-height:1.3;">${escapeHtml(content.heading)}</h1>
                ${paragraphsHtml}
                ${actionHtml}
                <p style="margin:24px 0 0;line-height:1.6;color:#51463d;">Con cariño,<br><strong>El equipo de Canela en Rama</strong></p>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;color:#7a7068;font-size:12px;text-align:center;">Este mensaje fue enviado por Canela en Rama.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const text = [
    "Canela en Rama",
    "",
    content.greeting,
    content.heading,
    "",
    ...content.paragraphs,
    ...(content.action ? ["", `${content.action.label}: ${content.action.url}`] : []),
    "",
    "Con cariño,",
    "El equipo de Canela en Rama",
  ].join("\n");
  return { html, text };
}

export async function sendBrandedEmail(input: SendBrandedEmailInput): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    throw new Error("Configurá RESEND_API_KEY y RESEND_FROM_EMAIL para enviar correos");
  }

  const { logoUrl } = emailBrandingConfig();
  const { html, text } = renderBrandedEmail(input, logoUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
    },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, text, html }),
    signal: AbortSignal.timeout(15000),
  });
  const body: unknown = await response.json().catch(() => null);
  const emailId =
    body && typeof body === "object" && "id" in body && typeof body.id === "string" ? body.id : null;
  if (!response.ok || !emailId) {
    const message = body && typeof body === "object" && "message" in body && typeof body.message === "string"
      ? body.message
      : `HTTP ${response.status}`;
    throw new ExternalServiceError("Resend", message);
  }
  return { id: emailId };
}

export async function sendPasswordSetupEmail(input: { user: { email: string }; passwordResetLink: string }): Promise<void> {
  await sendBrandedEmail({
    to: input.user.email,
    subject: "Tu acceso a Canela en Rama",
    preheader: "Creá o actualizá tu contraseña de forma segura.",
    greeting: "Hola,",
    heading: "Te ayudamos con tu acceso",
    paragraphs: [
      "Desde acá podés crear tu contraseña para empezar a usar tu cuenta o actualizar la que ya tenés.",
      "Si no solicitaste este enlace, podés ignorar este mensaje; tu cuenta seguirá segura.",
    ],
    action: { label: "Crear o cambiar contraseña", url: input.passwordResetLink },
  });
}

export async function sendEmailVerification(input: { user: { email: string }; emailVerifyLink: string }): Promise<void> {
  await sendBrandedEmail({
    to: input.user.email,
    subject: "Confirmá tu correo en Canela en Rama",
    preheader: "Un paso más para dejar tu cuenta lista.",
    greeting: "Hola,",
    heading: "¡Gracias por sumarte!",
    paragraphs: [
      "Para cuidar tu cuenta y asegurarnos de que podamos contactarte, confirmá tu correo con el botón.",
      "Si no creaste esta cuenta, podés ignorar este mensaje.",
    ],
    action: { label: "Confirmar mi correo", url: input.emailVerifyLink },
  });
}
