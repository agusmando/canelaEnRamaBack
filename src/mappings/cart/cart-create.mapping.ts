export const cartCreateMapping = {
  // Campos simples del producto
  sessionId: { parseString: true },
  userSuperTokensId: { string: true },

  // Relaciones simples (Conectar)
  user: { relation: true, connectField: "id" },
};
