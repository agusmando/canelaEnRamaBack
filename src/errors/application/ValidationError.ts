/** Datos inválidos (400). El mensaje se muestra tal cual al usuario: escribirlo en español y claro. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
