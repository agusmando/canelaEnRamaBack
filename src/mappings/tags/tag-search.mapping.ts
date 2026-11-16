export const tagSearchQueryMapping = {
  name: { field: "name", type: "string" },
  active: { field: "active", type: "boolean" },
  products: { field: "products", type: "relationArray", childField: "name" },
};
