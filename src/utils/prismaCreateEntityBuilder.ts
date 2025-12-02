export const prismaCreateEntityBuilder = (data: any, mapping?: any) => {
  if (!data || typeof data !== "object") return data;
  const result: any = { ...data };

  for (const key of Object.keys(data)) {
    const map = mapping?.[key];
    const val = data[key];

    // Si no hay mapping, deja el valor tal cual
    if (!map || !map.relation) continue;

    // Normaliza arrays y objetos
    if (Array.isArray(val)) {
      if (val.length === 0) {
        delete result[key];
        continue;
      }
      // elementos objeto con id => connect by id
      if (typeof val[0] === "object") {
        if ("id" in val[0]) {
          result[key] = {
            connect: val.map((it: any) => ({
              [map.connectField || "id"]: it.id,
            })),
          };
        } else if (map.allowCreate) {
          result[key] = { create: val };
        } else {
          delete result[key];
        }
      } else {
        // array de primitvos => connect by id
        result[key] = {
          connect: val.map((id: any) => ({ [map.connectField || "id"]: id })),
        };
      }
    } else if (val && typeof val === "object") {
      if ("id" in val) {
        result[key] = { connect: { [map.connectField || "id"]: val.id } };
      } else if (map.allowCreate) {
        result[key] = { create: val };
      } else {
        delete result[key];
      }
    } else {
      // primitivo => connect single id
      result[key] = { connect: { [map.connectField || "id"]: val } };
    }
  }

  return result;
};
