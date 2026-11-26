import { describe, expect, it } from "vitest";
import { assertImageBuffer, detectImageMimeType } from "../src/utils/imageSignature.js";

const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
const jpeg = () => {
  const b = Buffer.alloc(16);
  b[0] = 0xff;
  b[1] = 0xd8;
  b[2] = 0xff;
  return b;
};
const gif = () => Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(8)]);
const webp = () => {
  const b = Buffer.alloc(16);
  b.write("RIFF", 0, "ascii");
  b.write("WEBP", 8, "ascii");
  return b;
};
const avif = () => {
  const b = Buffer.alloc(24);
  b.writeUInt32BE(24, 0);
  b.write("ftyp", 4, "ascii");
  b.write("avif", 8, "ascii");
  b.write("mif1", 16, "ascii");
  return b;
};

describe("imageSignature", () => {
  it.each([
    ["image/png", png()],
    ["image/jpeg", jpeg()],
    ["image/gif", gif()],
    ["image/webp", webp()],
    ["image/avif", avif()],
  ] as const)("detecta %s por magic bytes", (mime, buffer) => {
    expect(detectImageMimeType(buffer)).toBe(mime);
    expect(() => assertImageBuffer({ buffer, mimetype: mime })).not.toThrow();
  });

  it("rechaza contenido que no es imagen aunque el mimetype declarado sea válido", () => {
    expect(() => assertImageBuffer({ buffer: Buffer.from("<svg/onload=alert(1)>"), mimetype: "image/png" })).toThrow(
      /no coincide/,
    );
    expect(() => assertImageBuffer({ buffer: jpeg(), mimetype: "image/png" })).toThrow(/no coincide/);
  });

  it("rechaza buffers vacíos o truncados", () => {
    expect(detectImageMimeType(Buffer.alloc(0))).toBeNull();
    expect(detectImageMimeType(Buffer.from("RIFF"))).toBeNull();
  });
});
