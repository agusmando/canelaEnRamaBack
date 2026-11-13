export class DatabaseError extends Error {
  constructor(message = "Database error", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DatabaseError";
  }
}
