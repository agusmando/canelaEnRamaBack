import dotenv from "dotenv";
import supertokens from "supertokens-node";
import Session from "supertokens-node/recipe/session";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import ThirdParty from "supertokens-node/recipe/thirdparty";
import Dashboard from "supertokens-node/recipe/dashboard"; // Usa el paquete de backend aquí
import UserRoles from "supertokens-node/recipe/userroles"; // Usa el paquete de backend aquí
import UserMetadata from "supertokens-node/recipe/usermetadata";
import EmailVerification from "supertokens-node/recipe/emailverification";
import { prisma } from "../prisma/client.js";
import { passwordResetEmailDelivery } from "./email.js";
import { accountRecipes, NOT_ALLOWED_REASON } from "./account-linking.js";
import { getLogger, errInfo } from "../logger.js";

const log = getLogger("auth");

/** userContext de EmailPassword.signUp para no mandar el mail de verificación (ej. invitaciones). */
export type SignUpContext = { skipVerificationEmail?: boolean };

/**
 * Crea o completa el User de la base. Con account linking, `id` puede ser el de
 * una cuenta que ya existía (la persona entró con otro método): solo se
 * completan los datos que falten, no se pisa lo que cargó en su perfil.
 */
async function upsertUser(id: string, data: { email?: string; name?: string; avatarUrl?: string }) {
  const existing = await prisma.user.findUnique({ where: { supertokensId: id } });
  if (!existing) {
    await prisma.user.create({
      data: { supertokensId: id, email: data.email ?? "", name: data.name?.trim() ?? "", avatarUrl: data.avatarUrl ?? "" },
    });
    return;
  }
  const update: Record<string, string> = {};
  if (!existing.email && data.email) update.email = data.email;
  if (!existing.name?.trim() && data.name?.trim()) update.name = data.name.trim();
  if (!existing.avatarUrl && data.avatarUrl) update.avatarUrl = data.avatarUrl;
  if (Object.keys(update).length) await prisma.user.update({ where: { supertokensId: id }, data: update });
}

dotenv.config();
export const initSupertokens = () =>
  supertokens.init({
    framework: "express",
    supertokens: {
      // We use try.supertokens for demo purposes.
      // At the end of the tutorial we will show you how to create
      // your own SuperTokens core instance and then update your config.
      connectionURI: process.env.SUPERTOKENS_CONNECTION_URI as string,
      apiKey: process.env.SUPERTOKENS_API_KEY,
    },
    appInfo: {
      // learn more about this on https://supertokens.com/docs/session/appinfo
      appName: "Canela en Rama",
      apiDomain: process.env.API_DOMAIN ?? "https://canelaenramaback.onrender.com",
      websiteDomain: process.env.WEBSITE_DOMAIN ?? "http://localhost:5173",
      apiBasePath: "/api/auth",
      websiteBasePath: "/auth",
    },
    recipeList: [
      // SUPERTOKENS_DASHBOARD_ADMINS="a@x.com,b@x.com": solo esos emails pueden MODIFICAR
      // desde el dashboard de SuperTokens; el resto lo ve en solo lectura.
      // Sin definir: cualquier usuario del dashboard puede modificar.
      Dashboard.init({
        admins: process.env.SUPERTOKENS_DASHBOARD_ADMINS
          ? process.env.SUPERTOKENS_DASHBOARD_ADMINS.split(",").map((e) => e.trim()).filter(Boolean)
          : undefined,
      }),
      UserRoles.init(),
      UserMetadata.init(),
      // Verificación de email + "una sola cuenta por persona" (ver account-linking.ts)
      ...accountRecipes(),
      EmailPassword.init({
        // Mail de recuperar contraseña (SMTP propio, en español). Ver email.ts.
        emailDelivery: passwordResetEmailDelivery(),
        override: {
          functions: (original) => ({
            ...original,
            async signUp(input) {
              const response = await original.signUp(input);
              if (response.status === "OK") {
                const email = response.user.emails[0];
                await upsertUser(response.user.id, { email });
                // Mail de "confirmá tu email": hace falta para poder vincular Google
                const skip = (input.userContext as SignUpContext | undefined)?.skipVerificationEmail;
                if (!skip) {
                  EmailVerification.sendEmailVerificationEmail(
                    input.tenantId,
                    response.user.id,
                    response.recipeUserId,
                    email,
                  ).catch((err: any) => log.warn(errInfo(err), "No se pudo mandar el mail de verificación"));
                }
              }
              return response;
            },
          }),
          apis: (original) => ({
            ...original,
            async signUpPOST(input) {
              const res = await original.signUpPOST!(input);
              return res.status === "SIGN_UP_NOT_ALLOWED" ? { ...res, reason: NOT_ALLOWED_REASON.signUp } : res;
            },
            async signInPOST(input) {
              const res = await original.signInPOST!(input);
              return res.status === "SIGN_IN_NOT_ALLOWED" ? { ...res, reason: NOT_ALLOWED_REASON.signIn } : res;
            },
            async generatePasswordResetTokenPOST(input) {
              const res = await original.generatePasswordResetTokenPOST!(input);
              return res.status === "PASSWORD_RESET_NOT_ALLOWED" ? { ...res, reason: NOT_ALLOWED_REASON.passwordReset } : res;
            },
          }),
        },
      }),
      ThirdParty.init({
        signInAndUpFeature: {
          providers: [
            {
              config: {
                thirdPartyId: "google",
              },
            },
          ],
        },
        override: {
          functions: (original) => ({
            ...original,
            async signInUp(input) {
              const response = await original.signInUp(input);
              if (response.status === "OK") {
                const rawInfo = response.rawUserInfoFromProvider.fromUserInfoAPI;
                const name = `${rawInfo?.given_name || ""} ${rawInfo?.family_name || ""}`.trim();
                // Con account linking, response.user.id es el de la cuenta principal
                await upsertUser(response.user.id, {
                  email: response.user.emails[0],
                  name,
                  avatarUrl: rawInfo?.picture || "",
                });
              }
              return response;
            },
          }),
          apis: (original) => ({
            ...original,
            async signInUpPOST(input) {
              const res = await original.signInUpPOST!(input);
              return res.status === "SIGN_IN_UP_NOT_ALLOWED" ? { ...res, reason: NOT_ALLOWED_REASON.thirdParty } : res;
            },
          }),
        },
      }),
      Session.init({
        // Solo tokens en header (Authorization: Bearer). Al no aceptar cookies de
        // sesión, un sitio ajeno no puede hacer requests autenticadas en nombre
        // del usuario: CSRF queda descartado por diseño.
        getTokenTransferMethod: () => "header",
      }),
    ],
  });
