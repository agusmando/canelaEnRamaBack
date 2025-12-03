import dotenv from "dotenv";
import supertokens from "supertokens-node";
import Session from "supertokens-node/recipe/session";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import ThirdParty from "supertokens-node/recipe/thirdparty";
import Dashboard from "supertokens-node/recipe/dashboard"; // Usa el paquete de backend aquí
import UserRoles from "supertokens-node/recipe/userroles"; // Usa el paquete de backend aquí
import UserMetadata from "supertokens-node/recipe/usermetadata";
import Prisma from "@prisma/client";

dotenv.config();

const { PrismaClient } = Prisma;
const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});
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
      apiDomain: "http://localhost:8080",
      websiteDomain: "http://localhost:3000",
      apiBasePath: "/api/auth",
      websiteBasePath: "/auth",
    },
    recipeList: [
      Dashboard.init(),
      UserRoles.init(),
      UserMetadata.init(),
      EmailPassword.init(), // initializes signin / sign up features
      ThirdParty.init({
        override: {
          functions: (orig) => ({
            ...orig,
            signInUp: async (input: any) => {
              const resp = await orig.signInUp(input);

              if (resp.status === "OK") {
                const { user } = resp;
                console.log(user, resp);
                await prisma.user.create({
                  data: {
                    supertokensId: user.id,
                    email: user.emails[0],
                    avatarUrl:
                      resp.rawUserInfoFromProvider.fromUserInfoAPI?.picture ||
                      "",
                    //falta pedir el nombre cuando uno le da permiso a la creación de cuentas con google
                  },
                });
              }

              return resp;
            },
          }),
        },
      }),
      Session.init({
        exposeAccessTokenToFrontendInCookieBasedAuth: true,
      }), // initializes session features
    ],
  });
