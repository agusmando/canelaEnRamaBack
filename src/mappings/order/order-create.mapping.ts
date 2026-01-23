

export const orderCreateMapping = {
  // Campos simples del producto
  userSuperTokensId: { parseInt: true },
  totalPrice: { parseFloat: true },
  totalItems: { parseInt: true },
  paymentType: { field: "paymentType" },
  status: { field: "status" },
  estimatedReadyAt: { field: "estimatedReadyAt" },
  // Relaciones simples (Conectar)
  user: { relation: true, connectField: "userSuperTokensId" },
  // Relaciones multiples (Conectar)
  orderItems: { relation: true, connectField: "id" },
};
