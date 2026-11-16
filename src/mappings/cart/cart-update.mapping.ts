export const cartUpdateMapping = {
  // Relaciones simples
  sessionId: { relation: true, connectField: "id" },
  userSuperTokensId: { relation: true, connectField: "id" },

  // addItem?: CreateCartItemDto[];
  // removeItem?: number[];

  // stockIncrement: {
  //   transform: (qty: number, fullData: any) => ({
  //     currentStock: { increment: qty },

  //     movements: {
  //       create: {
  //         quantity: qty,
  //         type: fullData.movementType || (qty < 0 ? "OUT" : "IN"),
  //       },
  //     },
  //   }),
  // },

  // currentStock: {
  //   transform: (finalValue: number, fullData: any) => ({
  //     currentStock: finalValue,

  //     movements: {
  //       create: {
  //         quantity: finalValue,
  //         type: fullData.movementType || "ADJUSTMENT",
  //       },
  //     },
  //   }),
  // },
};
