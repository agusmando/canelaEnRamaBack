export const categorySearchQueryMapping = {
  ofuscatedId: { field: "id", type: "number" },
  name: { field: "name", type: "string" },
  description: { field: "description", type: "string" },
  active: { field: "active", type: "boolean" },
  products: { field: "products", type: "relationArray", childField: "name" },
};
