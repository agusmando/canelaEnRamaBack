import { prisma as sharedPrisma } from "../config/prisma/client.js";
import { ValidationError } from "../errors/application/ValidationError.js";

/**
 * Configuración del comercio (tabla StoreSettings, fila única id=1).
 * `hours`: 7 entradas, una por día con `day` 0=Lunes … 6=Domingo:
 *   { day, closed: boolean, ranges: [{ open: "HH:MM", close: "HH:MM" }] }
 * `ranges` admite hasta 2 tramos por día (corrimiento partido, corte de almuerzo).
 */
export interface BusinessHourRange {
  open: string;
  close: string;
}

export interface BusinessHour {
  day: number;
  closed: boolean;
  ranges: BusinessHourRange[];
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_RANGES = 2;
const DEFAULT_RANGES: BusinessHourRange[] = [
  { open: "09:00", close: "13:00" },
  { open: "16:00", close: "21:00" },
];
const DEFAULT_HOURS: BusinessHour[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  closed: day === 6,
  ranges: DEFAULT_RANGES.map((r) => ({ ...r })),
}));

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

const validRange = (r: any): BusinessHourRange | null => {
  const open = String(r?.open ?? "");
  const close = String(r?.close ?? "");
  if (!TIME_RE.test(open) || !TIME_RE.test(close) || toMinutes(open) >= toMinutes(close)) return null;
  return { open, close };
};

export function normalizeHours(raw: unknown): BusinessHour[] {
  if (!Array.isArray(raw)) return DEFAULT_HOURS.map((h) => ({ day: h.day, closed: h.closed, ranges: h.ranges.map((r) => ({ ...r })) }));
  const byDay = new Map<number, BusinessHour>();
  for (const h of raw) {
    const day = Number((h as any)?.day);
    if (!Number.isInteger(day) || day < 0 || day > 6 || byDay.has(day)) continue;
    const closed = (h as any)?.closed === true;
    const rawRanges: unknown[] = Array.isArray((h as any)?.ranges) ? (h as any).ranges : [];
    const ranges = rawRanges
      .map(validRange)
      .filter((r): r is BusinessHourRange => r !== null)
      .slice(0, MAX_RANGES);
    // Día abierto sin rangos válidos → no lo guardamos (cae al default).
    if (!closed && !ranges.length) continue;
    byDay.set(day, {
      day,
      closed,
      ranges: closed ? [] : ranges.sort((a, b) => toMinutes(a.open) - toMinutes(b.open)),
    });
  }
  return DEFAULT_HOURS.map((d) => {
    const found = byDay.get(d.day);
    return found ?? { day: d.day, closed: d.closed, ranges: d.ranges.map((r) => ({ ...r })) };
  });
}

/** Texto corto para mails y web: "Lun a Sáb: 9:00 a 13:00 y 16:00 a 21:00 · Dom: cerrado". */
export function formatHoursText(hours: BusinessHour[]): string {
  const DAY = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const sig = (h: BusinessHour) => (h.closed ? "c" : h.ranges.map((r) => `${r.open}-${r.close}`).join("|"));
  const parts: string[] = [];
  let i = 0;
  while (i < hours.length) {
    const h = hours[i];
    let j = i;
    while (j + 1 < hours.length && sig(hours[j + 1]) === sig(h)) j++;
    const label = j > i ? `${DAY[i]} a ${DAY[j]}` : DAY[i];
    parts.push(
      h.closed
        ? `${label}: cerrado`
        : `${label}: ${h.ranges.map((r) => `${r.open} a ${r.close}`).join(" y ")}`,
    );
    i = j + 1;
  }
  return parts.join(" · ");
}

export class SettingsService {
  constructor(private readonly prisma: any = sharedPrisma) {}

  async getHours(): Promise<{ hours: BusinessHour[]; updatedAt: Date | null }> {
    const row = await this.prisma.storeSettings.findUnique({ where: { id: 1 } });
    return { hours: normalizeHours(row?.hours), updatedAt: row?.updatedAt ?? null };
  }

  async saveHours(body: any): Promise<{ hours: BusinessHour[]; updatedAt: Date | null }> {
    const raw = Array.isArray(body?.hours) ? body.hours : body;
    if (!Array.isArray(raw) || raw.length !== 7) {
      throw new ValidationError("hours debe ser un array de 7 días (0=Lunes … 6=Domingo)");
    }
    const seen = new Set<number>();
    const hours = raw.map((h: any, idx: number) => {
      const day = Number(h?.day ?? idx);
      if (!Number.isInteger(day) || day < 0 || day > 6 || seen.has(day)) {
        throw new ValidationError("Cada día debe tener day único entre 0 y 6");
      }
      seen.add(day);
      const closed = h?.closed === true;
      const rawRanges: unknown[] = Array.isArray(h?.ranges) ? h.ranges : [];
      if (rawRanges.length > MAX_RANGES) throw new ValidationError(`Máximo ${MAX_RANGES} franjas por día`);
      const ranges = rawRanges
        .map(validRange)
        .filter((r): r is BusinessHourRange => r !== null)
        .sort((a, b) => toMinutes(a.open) - toMinutes(b.open));
      if (!closed && !ranges.length) {
        throw new ValidationError(`El día ${day} está abierto pero no tiene franjas válidas (HH:MM, apertura < cierre)`);
      }
      return { day, closed, ranges: closed ? [] : ranges };
    });
    hours.sort((a, b) => a.day - b.day);
    const row = await this.prisma.storeSettings.upsert({
      where: { id: 1 },
      create: { id: 1, hours },
      update: { hours },
    });
    return { hours: normalizeHours(row.hours), updatedAt: row.updatedAt };
  }
}
