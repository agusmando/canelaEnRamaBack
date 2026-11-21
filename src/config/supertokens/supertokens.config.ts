import dotenv from "dotenv";
import supertokens from "supertokens-node";
import Session from "supertokens-node/recipe/session";
import AccountLinking from "supertokens-node/recipe/accountlinking";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import EmailVerification from "supertokens-node/recipe/emailverification";
import ThirdParty from "supertokens-node/recipe/thirdparty";
import Dashboard from "supertokens-node/recipe/dashboard"; // Usa el paquete de backend aquí
import UserRoles from "supertokens-node/recipe/userroles"; // Usa el paquete de backend aquí
import UserMetadata from "supertokens-node/recipe/usermetadata";
import { prisma } from "../prisma/client.js";
import {
  isBrandedEmailConfigured,
  sendEmailVerification,
  sendPasswordSetupEmail,
} from "../../services/email.service.js";

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
      Dashboard.init(),
      UserRoles.init(),
      UserMetadata.init(),
      EmailVerification.init({
        mode: "OPTIONAL",
        ...(isBrandedEmailConfigured()
          ? { emailDelivery: { service: { sendEmail: sendEmailVerification } } }
          : {}),
      }),
      AccountLinking.init({
        shouldDoAutomaticAccountLinking: async (newAccountInfo, user) => {
          if (
            !user ||
            newAccountInfo.recipeId !== "thirdparty" ||
            newAccountInfo.thirdParty?.id !== "google" ||
            !newAccountInfo.email ||
            !user.loginMethods.some(
              (method) =>
                method.recipeId === "emailpassword" &&
                method.email?.toLowerCase() === newAccountInfo.email?.toLowerCase(),
            )
          ) {
            return { shouldAutomaticallyLink: false };
          }

          const existingAccount = await prisma.user.findUnique({
            where: { supertokensId: user.id },
            select: { role: true },
          });
          const isInvitedStaff =
            existingAccount?.role === "ADMIN" ||
            existingAccount?.role === "EDITOR" ||
            existingAccount?.role === "EMPLOYEE";
          if (!isInvitedStaff) return { shouldAutomaticallyLink: false };
          return { shouldAutomaticallyLink: true, shouldRequireVerification: true };
        },
      }),
      EmailPassword.init({
        ...(isBrandedEmailConfigured()
          ? { emailDelivery: { service: { sendEmail: sendPasswordSetupEmail } } }
          : {}),
        // ... otras configuraciones ...
        override: {
          functions: (original) => ({
            ...original,
            async signUp(input) {
              const response = await original.signUp(input);

              if (response.status === "OK") {
                const email = response.user.emails[0];
                const fullName = "";
                const avatarUrl = "";

                // Aquí agregas tu lógica para guardar los datos en la base de datos
                await prisma.user.upsert({
                  where: { supertokensId: response.user.id },
                  update: {
                    email,
                    name: fullName,
                    avatarUrl,
                  },
                  create: {
                    supertokensId: response.user.id,
                    email,
                    name: fullName,
                    avatarUrl,
                  },
                });
              }

              return response;
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
                const rawInfo =
                  response.rawUserInfoFromProvider.fromUserInfoAPI;

                const email = response.user.emails[0];
                const firstName = rawInfo?.given_name || "";
                const lastName = rawInfo?.family_name || "";
                const fullName = firstName + " " + lastName;
                const avatarUrl = rawInfo?.picture || "";

                await prisma.user.upsert({
                  where: { supertokensId: response.user.id },
                  update: {
                    email,
                    name: firstName + " " + lastName,
                    avatarUrl,
                  },
                  create: {
                    supertokensId: response.user.id,
                    email,
                    name: fullName,
                    avatarUrl,
                  },
                });
              }

              return response;
            },
          }),
        },
      }),
      Session.init({
        exposeAccessTokenToFrontendInCookieBasedAuth: true,
      }), // initializes session features
    ],
  });
