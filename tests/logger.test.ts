import { describe, expect, it } from "vitest";
import { maskEmail } from "../src/config/logger.js";

describe("logger", () => {
  it("enmascara emails", () => {
    expect(maskEmail("juan.perez@gmail.com")).toBe("ju***@gmail.com");
    expect(maskEmail("a@b.com")).toBe("a***@b.com");
    expect(maskEmail("sin-arroba")).toBe("***");
    expect(maskEmail(null)).toBeNull();
  });
});
