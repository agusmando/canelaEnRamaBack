export const supplierUpdateMapping = {
  // Campos simples
  name: { field: "name" },
  contact: { field: "contact" },
  description: { field: "description" },
  active: { field: "active" },

  // Relaciones simples
  brands: { relation: true, connectField: "id" },
};
