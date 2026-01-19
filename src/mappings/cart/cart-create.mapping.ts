export const CartCreateMapping = {
  // Campos simples del producto
  sessionId: { parseInt: true },
  userId: { parseInt: true },

  // Relaciones simples (Conectar)
  user: { relation: true, connectField: "id" },
};
