export class DatabaseError extends Error {
  constructor() {
    super("Database error");
    this.name = "DatabaseError";
  }
}
