export const brandUpdateMapping = {
  // Campos simples
  name: { field: "name" },
  description: { field: "description" },
  active: { field: "active" },

  // Relaciones simples
  products: { relation: true, connectField: "id" },
};
