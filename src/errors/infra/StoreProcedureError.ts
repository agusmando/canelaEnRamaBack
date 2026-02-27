export class StoreProcedureError extends Error {
  constructor(name: string, error: any) {
    super("Store procedure error " + name + ": " + error);
  }
}
