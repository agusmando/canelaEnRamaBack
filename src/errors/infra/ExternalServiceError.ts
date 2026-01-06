export class ExternalServiceError extends Error {
  constructor(serviceName: string) {
    super(`External service '${serviceName}' not available`);
    this.name = "ExternalServiceError";
  }
}
