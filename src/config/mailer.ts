import nodemailer, { type Transporter } from "nodemailer";

/**
 * Envío de mails por SMTP propio (el mismo que usa SuperTokens para las
 * contraseñas, ver supertokens/email.ts).
 *
 *   SMTP_HOST, SMTP_PORT (465 = SSL, 587 = STARTTLS), SMTP_USER, SMTP_PASSWORD
 *   SMTP_FROM_EMAIL (por defecto SMTP_USER), SMTP_FROM_NAME (por defecto "Canela en Rama")
 *
 * Sin SMTP configurado los mails no se mandan (se avisa una vez en el log).
 */

export const escapeHtml = (text: string) =>
  String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const smtpSettings = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL, SMTP_FROM_NAME } = process.env;
  if (!SMTP_HOST || !SMTP_PASSWORD || !(SMTP_FROM_EMAIL || SMTP_USER)) return null;
  const port = Number(SMTP_PORT) || 587;
  return {
    host: SMTP_HOST,
    port,
    secure: port === 465,
    user: SMTP_USER,
    password: SMTP_PASSWORD,
    fromEmail: (SMTP_FROM_EMAIL || SMTP_USER)!,
    fromName: SMTP_FROM_NAME || "Canela en Rama",
  };
};

export const isMailConfigured = () => smtpSettings() !== null;

let transporter: Transporter | null = null;
let warned = false;

const getTransporter = () => {
  const cfg = smtpSettings();
  if (!cfg) return null;
  transporter ??= nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.password } : undefined,
  });
  return transporter;
};

/** Manda un mail. Devuelve false si no hay SMTP o si falla (nunca tira). */
export async function sendMail(mail: { to: string; subject: string; html: string; text?: string }): Promise<boolean> {
  const cfg = smtpSettings();
  const t = getTransporter();
  if (!cfg || !t) {
    if (!warned) console.warn("[mail] SMTP no configurado: no se mandan mails de pedidos");
    warned = true;
    return false;
  }
  try {
    await t.sendMail({ from: { name: cfg.fromName, address: cfg.fromEmail }, ...mail });
    return true;
  } catch (err: any) {
    console.warn(`[mail] no se pudo mandar "${mail.subject}" a ${mail.to}:`, err.message);
    return false;
  }
}

/** Plantilla común: encabezado con la marca, contenido y pie. `body` ya es HTML. */
export function emailLayout(opts: { title: string; body: string; button?: { label: string; href: string }; footer?: string }) {
  const button = opts.button
    ? `<p style="margin:24px 0">
              <a href="${escapeHtml(opts.button.href)}" style="display:inline-block;background:#cc3b1d;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px">
                ${escapeHtml(opts.button.label)}
              </a>
            </p>`
    : "";
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#faebe8;font-family:Arial,Helvetica,sans-serif;color:#282828">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px">
          <tr><td>
            <p style="margin:0 0 24px;font-size:22px;font-weight:bold;color:#cc3b1d">Canela en Rama</p>
            <h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(opts.title)}</h1>
            ${opts.body}
            ${button}
            <p style="margin:24px 0 0;font-size:13px;color:#666">
              ${opts.footer ?? "Cualquier consulta, respondé este mail o escribinos por WhatsApp."}
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
