import { Prisma } from "@prisma/client";
import { BadRequestError } from "../application/BadRequestError.js";
import { ConflictError } from "../application/ConflictError.js";
import { NotFoundError } from "../application/NotFoundError.js";
import { DatabaseError } from "./DatabaseError.js";
import { StoreProcedureError, extractRaiseMessage } from "./StoreProcedureError.js";

/**
 * Convierte errores de Prisma en errores de la aplicación con el status HTTP
 * correcto. Si ya es un error de la app, lo devuelve tal cual.
 */
export function translatePrismaError(error: unknown, spName?: string): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2025":
        return new NotFoundError();
      case "P2002":
        return new ConflictError(
          "Ya existe un registro con ese valor único: " +
            JSON.stringify(error.meta?.target ?? ""),
        );
      case "P2003":
        return new BadRequestError("Referencia inválida: " + String(error.meta?.field_name ?? ""));
    }
    if (spName || extractRaiseMessage(error)) {
      return new StoreProcedureError(spName ?? "unknown", error);
    }
    return new DatabaseError("Database error", { cause: error });
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return new BadRequestError("Datos inválidos para la entidad");
  }
  if (error instanceof Error) return error;
  return new DatabaseError("Database error", { cause: error });
}
