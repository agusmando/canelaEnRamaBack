
// product-create.mapping.ts
import { productVariantCreateMapping } from '../product-variants/product-variant-create.mapping.ts';

export const productCreateMapping = {
  // Campos simples del producto
  categoryId: { parseInt: true }, // Si envías el ID directamente en el body
  brandId: { parseInt: true },
  measureTypeId: { parseInt: true },
  active: { parseBoolean: true },

  // Relaciones simples (Conectar)
  Category: { relation: true, connectField: "id" }, 
  Brand: { relation: true, connectField: "id" },
  Tags: { relation: true, connectField: "id" },

  // Relación compleja (Crear anidados)
  variants: {
    relation: true,
    allowCreate: true,
    childMapping: productVariantCreateMapping, // <--- ESTO ACTIVA LA RECURSIÓN
  },
};