export const getAllowedCorsOrigins = (
  value: string | undefined,
  nodeEnv: string | undefined,
): string[] => {
  const origins = (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (nodeEnv === "production" && origins.length === 0) {
    throw new Error("CORS_ORIGINS es obligatorio en producción");
  }

  return origins;
};
