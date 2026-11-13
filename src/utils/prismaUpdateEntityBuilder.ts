// src/utils/prismaUpdateEntityBuilder.ts

const parseScalar = (map: any, val: any) => {
  if (val === null || val === undefined) return val;
  if (map.parseInt) return parseInt(val, 10);
  if (map.parseFloat) return parseFloat(val);
  if (map.parseBoolean) return val === true || val === "true" || val === 1 || val === "1";
  if (map.parseFloatArray) {
    const arr = Array.isArray(val) ? val : String(val).split(",");
    return arr.map((v: any) => parseFloat(v)).filter((n: number) => !Number.isNaN(n));
  }
  return val;
};

/**
 * Construye el `data` de un update de Prisma. Solo pasan los campos declarados
 * en el mapping (whitelist): cualquier otro campo del body se ignora.
 */
export const prismaUpdateEntityBuilder = (data: any, mapping?: any) => {
  if (!data || typeof data !== "object") return data;
  const result: any = {};

  for (const key of Object.keys(data)) {
    const map = mapping?.[key];
    const val = data[key];

    // 1. Si no hay mapping para este campo, lo ignoramos (seguridad)
    if (!map || val === undefined) continue;

    // 2. Transformación personalizada
    if (typeof map.transform === "function") {
      Object.assign(result, map.transform(val, data));
      continue;
    }

    // 3. Relaciones (Arrays): reemplaza la lista completa
    if (map.relation && Array.isArray(val)) {
      result[key] = {
        set: val.map((item: any) => ({ [map.connectField || "id"]: item?.id ?? item })),
      };
      continue;
    }

    // 4. Relaciones (Objeto único)
    if (map.relation && val && typeof val === "object") {
      result[key] = { connect: { [map.connectField || "id"]: val.id ?? val } };
      continue;
    }

    // 5. Campos simples (Primitivos)
    result[map.field || key] = parseScalar(map, val);
  }

  return result;
};
