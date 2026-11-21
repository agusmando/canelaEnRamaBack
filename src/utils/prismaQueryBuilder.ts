/**
 * Traduce los query params a un `where` de Prisma según las reglas del mapping.
 * Los campos que no estén en el mapping se ignoran (whitelist).
 */
export const prismaQueryBuilder = (receivedDto: any, mappingRules: any = {}) => {
  const where: any = {};
  const and: any[] = [];

  for (const key in receivedDto ?? {}) {
    const value = receivedDto[key];
    if (value === undefined || value === null || value === "") continue;

    const config = mappingRules?.[key];
    if (!config || !config.type) continue; // campo no permitido

    switch (config.type) {
      case "string":
        where[config.field] = { contains: String(value), mode: "insensitive" };
        break;

      case "search": {
        const terms = String(value).trim().split(/\s+/).filter(Boolean);
        for (const term of terms) {
          and.push({
            OR: (config.fields ?? []).map((field: any) => {
              const condition = { contains: term, mode: "insensitive" };
              if (!field.childField) return { [field.field]: condition };
              if (field.relation === "some") {
                return {
                  [field.field]: {
                    some: { [field.childField]: condition },
                  },
                };
              }
              return { [field.field]: { [field.childField]: condition } };
            }),
          });
        }
        break;
      }

      case "number": {
        const n = Number(value);
        if (!Number.isNaN(n)) where[config.field] = n;
        break;
      }

      case "boolean":
        where[config.field] = value === "true" || value === true;
        break;

      case "object":
        where[config.field] = {
          [config.childField]: { contains: String(value), mode: "insensitive" },
        };
        break;

      case "numberRange": {
        const n = Number(value);
        if (Number.isNaN(n)) break;
        if (config.operation === "gte" || config.operation === "lte") {
          where[config.field] = { ...where[config.field], [config.operation]: n };
        }
        break;
      }

      case "enum":
        where[config.field] = Array.isArray(value) ? { in: value } : value;
        break;

      case "date": {
        const dateValue = new Date(value);
        if (Number.isNaN(dateValue.getTime())) break;
        if (config.operation === "eq") {
          where[config.field] = {
            ...where[config.field],
            gte: dateValue,
            lt: new Date(dateValue.getTime() + 24 * 60 * 60 * 1000),
          };
        } else if (config.operation === "gte" || config.operation === "lte") {
          where[config.field] = { ...where[config.field], [config.operation]: dateValue };
        }
        break;
      }

      case "stringArray":
        if (config.operator === "contains") where[config.field] = { has: value };
        if (config.operator === "oneOf") where[config.field] = { hasSome: [].concat(value) };
        if (config.operator === "containsAll") where[config.field] = { hasEvery: [].concat(value) };
        break;

      case "textSearch": {
        // ?search=nuez mariposa -> cada palabra en alguno de los paths (AND de ORs)
        const words = String(value).trim().split(/\s+/).filter(Boolean).slice(0, 8);
        const paths: string[][] = config.paths ?? [];
        for (const word of words) {
          and.push({
            OR: paths.map((path) =>
              path.reduceRight<any>(
                (inner, key) => ({ [key]: inner }),
                { contains: word, mode: "insensitive" },
              ),
            ),
          });
        }
        break;
      }

      case "relationArray": {
        // ?tags=a&tags=b -> debe tener AMBOS tags
        const values: string[] = Array.isArray(value) ? value : [value];
        for (const val of values) {
          and.push({
            [config.field]: {
              some: { [config.childField]: { contains: String(val), mode: "insensitive" } },
            },
          });
        }
        break;
      }
    }
  }

  if (and.length) where.AND = and;
  return where;
};
