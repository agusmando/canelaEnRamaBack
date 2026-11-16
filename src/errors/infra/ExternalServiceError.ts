export class ExternalServiceError extends Error {
  constructor(serviceName: string, detail?: string) {
    super(`External service '${serviceName}' not available` + (detail ? `: ${detail}` : ""));
    this.name = "ExternalServiceError";
  }
}
