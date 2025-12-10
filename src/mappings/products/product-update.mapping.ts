// src/mappings/product-update.mapping.ts

export const productUpdateMapping = {
  // Campos simples
  name: { field: "name" },
  description: { field: "description" },
  price: { field: "price" },
  profitMargin: { field: "profitMargin" },
  active: { field: "active" },

  // Relaciones simples
  categoryId: { relation: true, connectField: "id" },
  Tags: { relation: true, connectField: "id" },
  brandId: { relation: true, connectField: "id" },

  // --- ESTRATEGIA 1: Diferencial (Recomendada para Ventas/Compras) ---
  // El frontend envía "stockIncrement" con la cantidad a sumar/restar
  stockIncrement: {
    transform: (qty: number, fullData: any) => ({
      // Prisma atomic increment: seguro contra concurrencia
      currentStock: { increment: qty },

      // Side effect: Crear el historial
      movements: {
        create: {
          quantity: qty, // Guardamos cuánto cambió (+10, -5)
          // Usamos el tipo que manda el front, o 'OUT' por defecto si es negativo, 'IN' si es positivo
          type: fullData.movementType || (qty < 0 ? "OUT" : "IN"),
        },
      },
    }),
  },

  // --- ESTRATEGIA 2: Absoluta (Para "Corregir" Inventario Manualmente) ---
  // El frontend envía "currentStock" con el valor final real
  currentStock: {
    transform: (finalValue: number, fullData: any) => ({
      currentStock: finalValue, // Set directo

      movements: {
        create: {
          quantity: finalValue, // Aquí guardamos el valor total
          // Es vital marcar esto como AJUSTE para no sumarlo erróneamente en reportes
          type: fullData.movementType || "ADJUSTMENT",
        },
      },
    }),
  },
};
