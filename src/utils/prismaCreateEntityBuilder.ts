// prismaCreateEntityBuilder.ts

export const prismaCreateEntityBuilder = (data: any, mapping?: any) => {
  if (!data || typeof data !== "object") return data;

  // Clonamos para no mutar el original
  const result: any = Array.isArray(data) ? [...data] : { ...data };

  for (const key of Object.keys(data)) {
    const map = mapping?.[key];
    const val = data[key];

    // 1. Si no hay valor o no hay mapa, pasamos al siguiente
    if (val === undefined || val === null || !map) continue;

    // 2. Conversiones de Tipos Primitivos (Int, Float, Boolean)
    if (map.parseInt) {
      result[key] = parseInt(val, 10);
      continue;
    }
    if (map.parseFloat) {
      result[key] = parseFloat(val);
      continue;
    }
    if (map.parseBoolean) {
      // Maneja "true", "false", 1, 0
      result[key] = val === "true" || val === true || val === "1" || val === 1;
      continue;
    }
    if (map.parseFloatArray) {
      if (Array.isArray(val)) {
        result[key] = val.map((item: any) => parseFloat(item));
        continue;
      }
    }

    // 3. Manejo de Relaciones
    if (map.relation) {
      // CASO A: Arrays (ej: variants, Tags)
      if (Array.isArray(val)) {
        if (val.length === 0) {
          delete result[key];
          continue;
        }

        // Si es para CREAR anidados (ej: variants dentro de Product)
        if (map.allowCreate && map.childMapping) {
          result[key] = {
            create: val.map((item: any) =>
              // AQUÍ ESTÁ LA CLAVE: Llamada Recursiva con el mapping del hijo
              prismaCreateEntityBuilder(item, map.childMapping)
            ),
          };
        }
        // Si es para CONECTAR por ID (ej: Tags)
        else {
          if (!Number.isNaN(val[0].id)) {
            result[key] = {
              connect: val.map((it: any) => ({
                [map.connectField || "id"]: Number(it.id || it),
              })),
            };
          } else {
            result[key] = {
              connect: val.map((it: any) => ({
                [map.connectField || "id"]: it.id || it,
              })),
            };
          }
        }
      }

      // CASO B: Objetos o Valores únicos (ej: categoryId, brandId implícitos)
      else if (typeof val === "object") {
        // Lógica similar para objetos simples si fuera necesario
        if (val.id) {
          result[key] = {
            connect: { [map.connectField || "id"]: Number(val.id) },
          };
        } else if (map.allowCreate && map.childMapping) {
          result[key] = {
            create: prismaCreateEntityBuilder(val, map.childMapping),
          };
        }
      }

      // CASO C: Primitivos que son FK directas (a veces pasa)
      else {
        // Normalmente esto no se mapea como 'relation', pero por si acaso
        if (!Number.isNaN(val[0].id)) {
          result[key] = { connect: { [map.connectField || "id"]: Number(val) } };
        } else {
            result[key] = { connect: { [map.connectField || "id"]: val } };
          }
      }
    }
  }

  return result;
};
