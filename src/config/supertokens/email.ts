import { SMTPService } from "supertokens-node/recipe/emailpassword/emaildelivery";
import { escapeHtml, smtpSettings } from "../mailer.js";

/**
 * Envío del mail de "recuperar contraseña" por SMTP propio (Gmail, Brevo,
 * Zoho, el hosting del dominio, etc.).
 *
 *   SMTP_HOST, SMTP_PORT (465 = SSL, 587 = STARTTLS), SMTP_USER, SMTP_PASSWORD
 *   SMTP_FROM_EMAIL (por defecto SMTP_USER), SMTP_FROM_NAME (por defecto "Canela en Rama")
 *
 * Sin SMTP configurado se devuelve `undefined` y SuperTokens usa su servicio
 * por defecto (mail genérico en inglés): sirve para probar, no para producción.
 */


/** Datos de la invitación al panel: el mismo enlace de "elegir contraseña" con otro texto. */
export type InviteContext = { invite: { roleLabel: string; dashboardUrl?: string } };

function passwordResetHtml(link: string, invite?: InviteContext["invite"]) {
  const href = escapeHtml(link);
  const title = invite ? "Te invitamos al panel" : "Recuperá tu contraseña";
  const intro = invite
    ? `Te dieron acceso al panel de administración de Canela en Rama como <strong>${escapeHtml(invite.roleLabel)}</strong>.
              Tocá el botón para elegir tu contraseña. El enlace vence en 1 hora; si venció, pedí uno nuevo con
              "¿Olvidaste tu contraseña?".`
    : `Recibimos un pedido para cambiar la contraseña de tu cuenta. Tocá el botón para elegir una nueva.
              El enlace vence en 1 hora y se puede usar una sola vez.`;
  const button = invite ? "Elegir contraseña" : "Cambiar contraseña";
  const footer = invite
    ? invite.dashboardUrl
      ? `Después entrá al panel en <a href="${escapeHtml(invite.dashboardUrl)}" style="color:#cc3b1d">${escapeHtml(invite.dashboardUrl)}</a> con tu email y la contraseña nueva.`
      : "Después entrá al panel con tu email y la contraseña nueva."
    : "Si no fuiste vos, ignorá este mail: tu contraseña no cambia.";
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#faebe8;font-family:Arial,Helvetica,sans-serif;color:#282828">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
          <tr><td>
            <p style="margin:0 0 24px;font-size:22px;font-weight:bold;color:#cc3b1d">Canela en Rama</p>
            <h1 style="margin:0 0 12px;font-size:20px">${title}</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.5">
              ${intro}
            </p>
            <p style="margin:0 0 24px">
              <a href="${href}" style="display:inline-block;background:#cc3b1d;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px">
                ${button}
              </a>
            </p>
            <p style="margin:0 0 8px;font-size:13px;color:#666">Si el botón no funciona, copiá este enlace en el navegador:</p>
            <p style="margin:0 0 24px;font-size:13px;word-break:break-all"><a href="${href}" style="color:#cc3b1d">${href}</a></p>
            <p style="margin:0;font-size:13px;color:#666">
              ${footer}
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function passwordResetEmailDelivery() {
  const cfg = smtpSettings();
  if (!cfg) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[auth] SMTP no configurado: el mail de recuperar contraseña usa el servicio genérico de SuperTokens");
    }
    return undefined;
  }

  return {
    service: new SMTPService({
      smtpSettings: {
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        authUsername: cfg.user,
        password: cfg.password,
        from: { name: cfg.fromName, email: cfg.fromEmail },
      },
      override: (original) => ({
        ...original,
        getContent: async (input) => {
          const invite = (input.userContext as Partial<InviteContext> | undefined)?.invite;
          return {
            toEmail: input.user.email,
            subject: invite ? "Tu acceso al panel · Canela en Rama" : "Recuperá tu contraseña · Canela en Rama",
            isHtml: true,
            body: passwordResetHtml(input.passwordResetLink, invite),
          };
        },
      }),
    }),
  };
}
