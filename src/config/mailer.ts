import nodemailer, { type Transporter } from "nodemailer";
import { getLogger, errInfo, maskEmail } from "./logger.js";

const log = getLogger("mail");

/**
 * Envío de mails (pedidos y, vía supertokens/email.ts, contraseñas y
 * verificación). Dos canales, en este orden:
 *
 *   1. Brevo por API HTTPS: BREVO_API_KEY. Funciona aunque el hosting bloquee
 *      los puertos SMTP (plan free de Render). El remitente (SMTP_FROM_EMAIL)
 *      tiene que estar verificado en Brevo → Senders.
 *   2. SMTP: SMTP_HOST, SMTP_PORT (465 = SSL, 587 = STARTTLS), SMTP_USER, SMTP_PASSWORD.
 *
 *   SMTP_FROM_EMAIL (por defecto SMTP_USER), SMTP_FROM_NAME (por defecto "Canela en Rama")
 *
 * Sin ninguno configurado los mails no se mandan (se avisa en el log).
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

const BREVO_URL = "https://api.brevo.com/v3";

/** Brevo: API key + remitente (el de SMTP_FROM_EMAIL / SMTP_USER). */
export const brevoSettings = () => {
  const { BREVO_API_KEY, SMTP_FROM_EMAIL, SMTP_USER, SMTP_FROM_NAME } = process.env;
  const fromEmail = SMTP_FROM_EMAIL || SMTP_USER;
  if (!BREVO_API_KEY || !fromEmail) return null;
  return { apiKey: BREVO_API_KEY, fromEmail, fromName: SMTP_FROM_NAME || "Canela en Rama" };
};

/** Remitente del canal activo (Brevo o SMTP), o null si no hay ninguno. */
export const mailSender = () => {
  const cfg = brevoSettings() ?? smtpSettings();
  return cfg ? { name: cfg.fromName, email: cfg.fromEmail } : null;
};

export const isMailConfigured = () => mailSender() !== null;

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
    // Por defecto nodemailer espera hasta 2 min: si el puerto está bloqueado
    // (p. ej. plan free de Render) el error tardaba en verse o no se veía nunca.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
};

type Mail = { to: string; subject: string; html: string; text?: string };

async function sendWithBrevo(cfg: NonNullable<ReturnType<typeof brevoSettings>>, mail: Mail) {
  const res = await fetch(`${BREVO_URL}/smtp/email`, {
    method: "POST",
    headers: { "api-key": cfg.apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: cfg.fromName, email: cfg.fromEmail },
      to: [{ email: mail.to }],
      subject: mail.subject,
      htmlContent: mail.html,
      ...(mail.text ? { textContent: mail.text } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo ${res.status}: ${body.slice(0, 300)}`);
  }
}

/** Manda un mail. Devuelve false si no hay canal configurado o si falla (nunca tira). */
export async function sendMail(mail: Mail): Promise<boolean> {
  const brevo = brevoSettings();
  if (brevo) {
    try {
      await sendWithBrevo(brevo, mail);
      log.info({ to: maskEmail(mail.to), subject: mail.subject, via: "brevo" }, `Mail enviado: "${mail.subject}"`);
      return true;
    } catch (err: any) {
      log.error({ to: maskEmail(mail.to), subject: mail.subject, via: "brevo", ...errInfo(err) }, `No se pudo mandar "${mail.subject}"`);
      return false;
    }
  }

  const cfg = smtpSettings();
  const t = getTransporter();
  if (!cfg || !t) {
    if (!warned) log.warn("SMTP no configurado: no se mandan mails de pedidos");
    warned = true;
    return false;
  }
  try {
    const start = Date.now();
    await t.sendMail({ from: { name: cfg.fromName, address: cfg.fromEmail }, ...mail });
    log.info({ to: maskEmail(mail.to), subject: mail.subject, ms: Date.now() - start }, `Mail enviado: "${mail.subject}"`);
    return true;
  } catch (err: any) {
    log.error({ to: maskEmail(mail.to), subject: mail.subject, ...errInfo(err) }, `No se pudo mandar "${mail.subject}"`);
    return false;
  }
}

/**
 * Al arrancar: prueba la conexión y el login SMTP y deja el resultado en el log,
 * para saber de entrada si los mails van a salir.
 */
export async function checkMail(): Promise<void> {
  const brevo = brevoSettings();
  if (brevo) {
    try {
      const res = await fetch(`${BREVO_URL}/account`, {
        headers: { "api-key": brevo.apiKey, accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
      log.info({ via: "brevo", from: brevo.fromEmail }, "Mail: Brevo OK (el remitente tiene que estar verificado en Brevo → Senders)");
    } catch (err: any) {
      log.error({ via: "brevo", ...errInfo(err) }, "Mail: Brevo con error, revisá BREVO_API_KEY");
    }
    return;
  }
  const cfg = smtpSettings();
  const t = getTransporter();
  if (!cfg || !t) {
    log.warn("Mail: sin canal configurado (falta BREVO_API_KEY o SMTP_HOST / SMTP_PASSWORD / SMTP_USER): no se mandan mails");
    return;
  }
  try {
    await t.verify();
    log.info({ via: "smtp", host: cfg.host, port: cfg.port }, "Mail: SMTP OK");
  } catch (err: any) {
    const hint =
      /timeout|ETIMEDOUT|ECONNREFUSED|ENETUNREACH/i.test(`${err.code} ${err.message}`)
        ? " → no se puede conectar al servidor SMTP (¿puerto bloqueado? el plan free de Render bloquea 25/465/587)"
        : /535|Invalid login|auth/i.test(err.message)
          ? " → usuario o contraseña rechazados (en Gmail hace falta una contraseña de aplicación)"
          : "";
    log.error({ via: "smtp", host: cfg.host, port: cfg.port, ...errInfo(err) }, `Mail: SMTP con error${hint}`);
  }
}

/** Marca del mail: logo alojado en la tienda (WEB_URL) si está configurada; si no, texto. */
const STORE_URL = (process.env.WEB_URL || "").replace(/\/+$/, "");
const LOGO_URL = STORE_URL ? `${STORE_URL}/logo-email.png` : null;

/** Plantilla común: encabezado con la marca, contenido y pie. `body` ya es HTML. */
export function emailLayout(opts: { title: string; body: string; button?: { label: string; href: string }; footer?: string }) {
  const button = opts.button
    ? `<p style="margin:24px 0">
              <a href="${escapeHtml(opts.button.href)}" style="display:inline-block;background:#cc3b1d;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px">
                ${escapeHtml(opts.button.label)}
              </a>
            </p>`
    : "";
  const brand = LOGO_URL
    ? `<img src="${LOGO_URL}" width="170" alt="Canela en Rama" style="display:block;border:0;height:auto;margin:0 0 20px">`
    : `<p style="margin:0 0 24px;font-size:22px;font-weight:bold;color:#cc3b1d">Canela en Rama</p>`;
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#faebe8;font-family:Arial,Helvetica,sans-serif;color:#282828">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px">
          <tr><td>
            ${brand}
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
