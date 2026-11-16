export const brandSearchQueryMapping = {
  ofuscatedId: { field: "id", type: "number" }, // Not supposed to be used directly
  name: { field: "name", type: "string" },
  description: { field: "description", type: "string" },
  products: { field: "products", type: "relationArray", childField: "name" },
  active: { field: "active", type: "boolean" },
  suppliers: { field: "suppliers", type: "relationArray", childField: "name" },
};
