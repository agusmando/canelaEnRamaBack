export class ServerError extends Error {
  constructor(name : string, error: string ) {
    super("Internal server error: " + name + ": " + error);
    this.name = "ServerError";
  }
}