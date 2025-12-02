export const supplierSearchQueryMapping = {
  ofuscatedId: { field: "id", type: "number" },
  name: { field: "name", type: "string" },
  contact: { field: "contact", type: "string" },
  active: { field: "active", type: "boolean" },
  description: { field: "description", type: "string" },
  createdAt: { field: "createdAt", type: "date" },
  updatedAt: { field: "updatedAt", type: "date" },
  brands: { field: "brands", type: "relationArray", childField: "name" },
};
