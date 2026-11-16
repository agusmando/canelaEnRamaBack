/**
 * Error lanzado por una función de Postgres.
 * `businessMessage` se completa cuando la función hizo RAISE EXCEPTION
 * (regla de negocio, ej. stock insuficiente) y se responde como 409.
 */
export class StoreProcedureError extends Error {
  businessMessage?: string;
  constructor(name: string, error: any) {
    const business = extractRaiseMessage(error);
    super(business ?? "Store procedure error " + name + ": " + (error?.message ?? error));
    this.name = "StoreProcedureError";
    this.businessMessage = business;
  }
}

/** Extrae el texto de un RAISE EXCEPTION (SQLSTATE P0001) de un error de Prisma. */
export function extractRaiseMessage(error: any): string | undefined {
  if (!error) return undefined;
  if (error instanceof StoreProcedureError) return error.businessMessage;
  const code = error?.meta?.code ?? error?.code;
  const raw: string = error?.meta?.message ?? error?.message ?? "";
  if (code === "P0001" || /\bP0001\b/.test(raw)) {
    const match = raw.match(/ERROR:\s*([^\n]+)/) ?? raw.match(/message: "([^"]+)"/);
    return (match?.[1] ?? raw).trim();
  }
  return undefined;
}
