import AccountLinking from "supertokens-node/recipe/accountlinking";
import EmailVerification from "supertokens-node/recipe/emailverification";
import { emailVerificationEmailDelivery } from "./email.js";

/**
 * Una sola cuenta por persona: si alguien entra con Google y ya tiene cuenta
 * con contraseña con el mismo email (o al revés), es el MISMO usuario
 * (mismos pedidos, carrito, direcciones y rol).
 *
 * Seguridad: solo se vincula con el email VERIFICADO en las dos cuentas
 * (`shouldRequireVerification`). Si no, alguien podría registrarse con
 * contraseña usando el email de otra persona y, cuando esa persona entrara
 * con Google, quedarse con acceso a su cuenta (o a su rol en el panel).
 *   - Google ya verifica el email.
 *   - Una cuenta con contraseña se verifica con el mail de verificación (se
 *     manda al registrarse y se puede reenviar desde "Mi cuenta") o al
 *     recuperar la contraseña.
 *   - Quien solo tiene Google y quiere contraseña usa "¿Olvidaste tu
 *     contraseña?": el enlace le agrega la contraseña a la MISMA cuenta.
 *
 * Account linking es una función paga del core de SuperTokens: hay que
 * activarla en supertokens.com (Core → Add-ons / Features) y recién ahí poner
 * ACCOUNT_LINKING=on. Con el core sin la función, prenderla rompe los logins.
 */
export const accountLinkingEnabled = () => process.env.ACCOUNT_LINKING === "on";

/**
 * Regla de vinculación: sin sesión abierta, vincular siempre que el email esté
 * verificado en las dos cuentas. Con sesión (agregar un método estando
 * logueado) no se vincula: las apps no tienen ese flujo.
 */
export const linkingDecision = async (_newAccountInfo: unknown, _user: unknown, session: unknown) =>
  session !== undefined
    ? ({ shouldAutomaticallyLink: false } as const)
    : ({ shouldAutomaticallyLink: true, shouldRequireVerification: true } as const);

export const accountRecipes = () => [
  // OPTIONAL: no bloquea nada; solo registra qué emails están verificados.
  EmailVerification.init({ mode: "OPTIONAL", emailDelivery: emailVerificationEmailDelivery() }),
  ...(accountLinkingEnabled()
    ? [
        AccountLinking.init({ shouldDoAutomaticAccountLinking: linkingDecision }),
      ]
    : []),
];

// ---------------------------------------------------------------- Mensajes

/** Textos en español para los casos en que SuperTokens no deja entrar por seguridad. */
export const NOT_ALLOWED_REASON = {
  /** Google, pero ya hay una cuenta con contraseña (sin verificar) con ese email. */
  thirdParty:
    "Ya tenés una cuenta con este email y contraseña. Ingresá con tu email y contraseña y confirmá tu email desde Mi cuenta (o usá «¿Olvidaste tu contraseña?»); después vas a poder entrar también con Google.",
  /** Registro con contraseña, pero ese email ya entra con Google. */
  signUp:
    "Ya existe una cuenta con este email. Ingresá con Google, o usá «¿Olvidaste tu contraseña?» para agregarle una contraseña a tu cuenta.",
  signIn: "No pudimos iniciar sesión con esta cuenta. Probá ingresar con Google o usá «¿Olvidaste tu contraseña?».",
  passwordReset:
    "No pudimos crear el enlace para esta cuenta. Ingresá con Google o escribinos por WhatsApp y te ayudamos.",
} as const;
