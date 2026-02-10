export class ValidationError extends Error {
  constructor(message: string) {
    super("Entity could not be validated: " + message);
    this.name = "ValidationError";
  }
}
