import { describe, expect, it } from "vitest";
import { formatHoursText, normalizeHours } from "../src/services/settings.service.js";

describe("settings hours", () => {
  it("sin datos devuelve el default: lun-sáb 9-13 y 16-21, domingo cerrado", () => {
    const hours = normalizeHours(null);
    expect(hours).toHaveLength(7);
    expect(hours[0]).toMatchObject({ day: 0, closed: false });
    expect(hours[0].ranges).toEqual([
      { open: "09:00", close: "13:00" },
      { open: "16:00", close: "21:00" },
    ]);
    expect(hours[6].closed).toBe(true);
  });

  it("normalizeHours descarta franjas inválidas y días abiertos sin franjas", () => {
    const hours = normalizeHours([
      { day: 0, closed: false, ranges: [{ open: "25:00", close: "13:00" }] }, // inválida → default
      { day: 1, closed: false, ranges: [{ open: "09:00", close: "13:00" }, { open: "16:00", close: "21:00" }] },
      { day: 2, closed: true, ranges: [{ open: "09:00", close: "13:00" }] }, // cerrado ignora franjas
    ]);
    expect(hours[0].ranges).toHaveLength(2); // cayó al default
    expect(hours[1].ranges).toHaveLength(2);
    expect(hours[2]).toMatchObject({ closed: true, ranges: [] });
  });

  it("formatHoursText agrupa días consecutivos con el mismo horario", () => {
    const text = formatHoursText(normalizeHours(null));
    expect(text).toBe("Lun a Sáb: 09:00 a 13:00 y 16:00 a 21:00 · Dom: cerrado");
  });

  it("formatHoursText separa días con horarios distintos", () => {
    const hours = normalizeHours(null);
    hours[5] = { day: 5, closed: false, ranges: [{ open: "10:00", close: "14:00" }] };
    expect(formatHoursText(hours)).toContain("Sáb: 10:00 a 14:00");
    expect(formatHoursText(hours)).toContain("Lun a Vie");
  });
});
