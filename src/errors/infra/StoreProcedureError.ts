export class StoreProcedureError extends Error {
  constructor(name: string) {
    super("Store procedure error " + name);
  }
}
