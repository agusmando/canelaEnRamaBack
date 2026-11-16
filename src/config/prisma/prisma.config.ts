// // prisma.config.ts
// import { defineConfig } from "@prisma/config";

// export default defineConfig({
// // Prisma buscará automáticamente la carpeta 'migrations' al lado de este archivo
// schema: "./src/config/prisma/schema.prisma",

// datasource: {
//   provider: "postgresql",
//   url: process.env.DATABASE_URL,
//   directUrl: process.env.DIRECT_URL,
// },

// generator: {
//   provider: "prisma-client-js",
// },
// });