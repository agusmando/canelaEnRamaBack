export const categorySearchQueryMapping = {
  name: { field: "name", type: "string" },
  description: { field: "description", type: "string" },
  active: { field: "active", type: "boolean" },
  products: { field: "products", type: "relationArray", childField: "name" },
};
