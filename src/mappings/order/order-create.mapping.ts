import { orderItemCreateMapping } from "../order-item/order-item-create.mapping.ts";


export const orderCreateMapping = {
  // Campos simples del producto
  userSuperTokensId: { field: "userSuperTokensId" },
  totalPrice: { parseFloat: true },
  totalItems: { parseInt: true },
  paymentType: { field: "paymentType" },
  status: { field: "status" },
  estimatedReadyAt: { field: "estimatedReadyAt" },
  // Relaciones simples (Conectar)
  user: { relation: true, connectField: "userSuperTokensId" },
  // Relaciones multiples (Conectar)
  orderItems: { relation: true, allowCreate: true, childMapping: orderItemCreateMapping },
};
