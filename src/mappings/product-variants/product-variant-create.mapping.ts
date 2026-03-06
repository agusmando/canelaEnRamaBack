// product-variant-create.mapping.ts

export const productVariantCreateMapping = {
  // Integers
  contentAmount: { parseInt: true },
  currentStock: { parseInt: true },
  roundingOption: { parseInt: true },
  productId: { parseInt: true },
  
  // Floats (IMPORTANTE: FormData envía strings, Prisma requiere Float)
  price: { parseFloat: true },
  profitMargin: { parseFloat: true },

  // array de float
  packagingOptions: { parseFloatArray: true },

  // Booleans
  active: { parseBoolean: true },
  availableWeb: { parseBoolean: true },
  availablePedidosYa: { parseBoolean: true },

  // Relaciones Anidadas dentro de la variante
  product: { relation: true, connectField: "id", allowCreate: false },
  movements: { 
    relation: true, 
    allowCreate: true,
    childMapping: {
      quantity: { parseInt: true },
      type: { field: "type" },
    } 

    // Si movements tuviera campos complejos, definirías un mapping para él aquí:
  },
  
  stockThreshold: { parseInt: true },

  // Relaciones Mix/Componentes (según tu JSON comentado)
  hasComponents: {
     relation: true,
     allowCreate: true,
     connectField: "id",
     childMapping: {
       productVariantId: { parseInt: true },
       quantity: { parseInt: true },
     }
  },

  images: {
    relation:  true,
    allowCreate: true,
    childMapping: {
      public_id: { field: "public_id" },
      secure_url: { field: "secure_url" },
    }
  }
};