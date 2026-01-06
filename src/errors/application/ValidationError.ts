export class ValidationError extends Error {
  constructor() {
    super("Entity could not be validated");
    this.name = "ValidationError";
  }
}
