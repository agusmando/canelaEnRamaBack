import { BadRequestError } from "../errors/application/BadRequestError.js";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const GIF_SIGNATURES = ["GIF87a", "GIF89a"];
const AVIF_BRANDS = new Set(["avif", "avis"]);

const startsWith = (buffer: Buffer, signature: number[], offset = 0) =>
  buffer.length >= offset + signature.length && signature.every((byte, i) => buffer[offset + i] === byte);

const ascii = (buffer: Buffer, offset: number, length: number) =>
  buffer.length >= offset + length ? buffer.subarray(offset, offset + length).toString("ascii") : "";

function isAvif(buffer: Buffer) {
  if (buffer.length < 16 || ascii(buffer, 4, 4) !== "ftyp") return false;
  const boxSize = buffer.readUInt32BE(0);
  const end = boxSize >= 16 && boxSize <= buffer.length ? boxSize : Math.min(buffer.length, 64);
  for (let offset = 8; offset + 4 <= end; offset += 4) {
    if (AVIF_BRANDS.has(ascii(buffer, offset, 4))) return true;
  }
  return false;
}

/** Detecta el tipo real por magic bytes; no confía en el mimetype declarado por el cliente. */
export function detectImageMimeType(buffer: Buffer): string | null {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (startsWith(buffer, PNG_SIGNATURE)) return "image/png";
  if (startsWith(buffer, JPEG_SIGNATURE)) return "image/jpeg";
  if (GIF_SIGNATURES.includes(ascii(buffer, 0, 6))) return "image/gif";
  if (ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 4) === "WEBP") return "image/webp";
  if (isAvif(buffer)) return "image/avif";
  return null;
}

export function assertImageBuffer(file: { buffer?: Buffer; mimetype?: string }) {
  const detected = detectImageMimeType(file?.buffer as Buffer);
  const declared = String(file?.mimetype ?? "").split(";")[0].trim().toLowerCase();
  if (!detected || detected !== declared) {
    throw new BadRequestError("El contenido del archivo no coincide con una imagen JPG, PNG, WEBP, GIF o AVIF válida");
  }
}
