// src/mappings/product-variants/product-variant-update.mapping.ts

/**
 * IMPORTANTE: `currentStock` y `stockIncrement` NO están acá a propósito.
 * El stock solo se modifica a través de las funciones SQL
 * (create_stock_movement / set_stock_level / process_mix_production) para que
 * siempre quede un StockMovement y no haya escrituras concurrentes.
 */
export const productVariantUpdateMapping = {
  // Campos simples
  name: { field: "name" },
  price: { field: "price", parseFloat: true },
  profitMargin: { field: "profitMargin", parseFloat: true },
  active: { field: "active", parseBoolean: true },
  contentMeasure: { field: "contentMeasure" },
  contentAmount: { field: "contentAmount", parseInt: true },
  packagingOptions: { field: "packagingOptions", parseFloatArray: true },
  requestTime: { field: "requestTime" },
  availableWeb: { field: "availableWeb", parseBoolean: true },
  availablePedidosYa: { field: "availablePedidosYa", parseBoolean: true },
  stockThreshold: { field: "stockThreshold", parseInt: true },
  roundingOption: { field: "roundingOption", parseInt: true },
  images: {
    transform: (imgs: any[]) => ({
      images: {
        create: imgs.map((image) => ({
          public_id: image.public_id,
          secure_url: image.secure_url,
        })),
      },
    }),
  },
};
