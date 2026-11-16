import { randomInt } from "node:crypto";

// Sin caracteres ambiguos (0/O, 1/I/L)
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Código público de seguimiento, p. ej. CER-7KQ2MZ9X. */
export const newTrackingCode = () =>
  "CER-" + Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
