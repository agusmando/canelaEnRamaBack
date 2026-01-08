// src/mappings/product-update.mapping.ts

export const productVariantUpdateMapping = {
  // Campos simples
  name: { field: "name" },
  price: { field: "price" },
  profitMargin: { field: "profitMargin" },
  active: { field: "active" },
  contentMeasure: { field: "contentMeasure" },
  contentAmount: { field: "contentAmount" },
  requestTime: { field: "requestTime" },

  // Relaciones simples
  measureTypeId: { relation: true, connectField: "id" },

  stockIncrement: {
    transform: (qty: number, fullData: any) => ({
      currentStock: { increment: qty },
    }),
  },
  currentStock: {
    transform: (finalValue: number, fullData: any) => ({
      currentStock: finalValue,
    }),
  },
  // Obtiene un array de public_id
  // removeImages: {
  //   transform: (images: any[], fullData: any) => ({
  //     images: {
  //       deleteMany: {
  //         public_id: {
  //           in: images.map((image) => image.public_id),
  //         },
  //       },
  //     },
  //   }),
  // },
  images: {
    transform: (imgs: any[], fullData: any) => ({
      images: {
        create: imgs.map((image) => ({
          public_id: image.public_id,
          secure_url: image.secure_url,
        })),
      },  
    })
  },
};
