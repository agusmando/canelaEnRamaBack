export class ForbidenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbidenError";
  }
}