export class ForbidenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbidenError";
  }
}
