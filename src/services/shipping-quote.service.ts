import { prisma as sharedPrisma } from "../config/prisma/client.js";
import { isUberConfigured, uberQuote, type UberAddress } from "../config/uber.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";
import { translatePrismaError } from "../errors/infra/translatePrismaError.js";

/**
 * Cotización de envíos a domicilio.
 *
 * Proveedores:
 *   - "uber": Uber Direct (si hay credenciales). Si falla o no cubre la zona, se usa la tarifa propia.
 *   - "own":  tarifa propia por departamento (ShippingZone), editable desde el dashboard.
 *
 * El precio SIEMPRE se calcula en el servidor (el checkout vuelve a cotizar).
 */

export type ShippingQuote = {
  available: boolean;
  provider: "uber" | "own" | null;
  price: number;
  currency: "ARS";
  etaMinutes: number | null;
  zone: string | null;
  /** id de la cotización del proveedor (Uber), si la hay. */
  providerQuoteId: string | null;
  /** Por qué no se puede enviar (sin domicilio, zona sin cobertura...). */
  reason: string | null;
};

export type AddressInput = {
  recipientName?: string;
  phone?: string;
  street?: string;
  number?: string;
  apartment?: string | null;
  zone?: string;
  city?: string | null;
  postalCode?: string | null;
  notes?: string | null;
};

const ADDRESS_FIELDS = ["recipientName", "phone", "street", "number", "apartment", "zone", "city", "postalCode", "notes"] as const;
const REQUIRED: (typeof ADDRESS_FIELDS)[number][] = ["recipientName", "phone", "street", "number", "zone"];
const LABELS: Record<string, string> = {
  recipientName: "quién recibe",
  phone: "teléfono",
  street: "calle",
  number: "número",
  zone: "departamento",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Origen de los envíos (el local). */
export const pickupInfo = () => ({
  name: process.env.SHIPPING_PICKUP_NAME || "Canela en Rama",
  phone: process.env.SHIPPING_PICKUP_PHONE || "5492615790124",
  address: {
    street: process.env.SHIPPING_PICKUP_STREET || "Colombia 1268",
    city: process.env.SHIPPING_PICKUP_CITY || "Godoy Cruz",
    state: process.env.SHIPPING_PICKUP_PROVINCE || "Mendoza",
    zipCode: process.env.SHIPPING_PICKUP_ZIP || "5501",
  } satisfies UberAddress,
});

/** Dirección de entrega en el formato que esperan los proveedores. */
export const dropoffAddress = (a: any): UberAddress => ({
  street: [a.street, a.number, a.apartment ? `(${a.apartment})` : ""].filter(Boolean).join(" "),
  city: a.city || a.zone,
  state: a.province || "Mendoza",
  zipCode: a.postalCode,
});

/** Calle, número y piso/depto (la localidad y el departamento van en sus propios campos). */
export const streetLine = (a: any) => [`${a.street} ${a.number}`.trim(), a.apartment].filter(Boolean).join(", ");

/** Dirección completa en una línea (para mostrar). */
export const addressLine = (a: any) =>
  [`${a.street} ${a.number}`, a.apartment, a.city && a.city !== a.zone ? a.city : null, a.zone].filter(Boolean).join(", ");

export class ShippingQuoteService {
  constructor(private readonly prisma: any = sharedPrisma) {}

  // ------------------------------------------------------------ Zonas

  /** Zonas activas (lo que ve el cliente al cargar su domicilio). */
  async publicZones() {
    return this.prisma.shippingZone.findMany({
      where: { active: true },
      select: { name: true, price: true, etaMinutes: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  /** Todos los departamentos (activos o no), para el selector del domicilio. */
  async zoneNames(): Promise<string[]> {
    const zones = await this.prisma.shippingZone.findMany({
      select: { name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return zones.map((z: any) => z.name);
  }

  async listZones() {
    return this.prisma.shippingZone.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  }

  private parseZone(data: any, isCreate: boolean) {
    const out: Record<string, any> = {};
    if (isCreate || data.name !== undefined) {
      const name = String(data.name ?? "").trim().slice(0, 80);
      if (!name) throw new ValidationError("El nombre del departamento es obligatorio");
      out.name = name;
    }
    if (isCreate || data.price !== undefined) {
      const price = Number(data.price);
      if (!Number.isFinite(price) || price < 0) throw new ValidationError("price debe ser un número >= 0");
      out.price = round2(price);
    }
    if (data.etaMinutes !== undefined) {
      if (data.etaMinutes === null || data.etaMinutes === "") out.etaMinutes = null;
      else {
        const eta = Number(data.etaMinutes);
        if (!Number.isInteger(eta) || eta <= 0) throw new ValidationError("etaMinutes debe ser un entero > 0");
        out.etaMinutes = eta;
      }
    }
    if (data.active !== undefined) out.active = data.active === true || data.active === "true";
    if (data.sortOrder !== undefined) {
      const order = Number(data.sortOrder);
      if (!Number.isInteger(order)) throw new ValidationError("sortOrder debe ser entero");
      out.sortOrder = order;
    }
    return out;
  }

  async createZone(data: any) {
    try {
      return await this.prisma.shippingZone.create({ data: this.parseZone(data ?? {}, true) });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  async updateZone(id: number, data: any) {
    try {
      return await this.prisma.shippingZone.update({ where: { id }, data: this.parseZone(data ?? {}, false) });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  // ------------------------------------------------------------ Domicilio

  async getAddress(userId: string) {
    return this.prisma.userAddress.findUnique({ where: { userSuperTokensId: userId } });
  }

  async saveAddress(userId: string, input: AddressInput) {
    const data: Record<string, any> = {};
    for (const key of ADDRESS_FIELDS) {
      const raw = (input as any)?.[key];
      const text = raw === undefined || raw === null ? "" : String(raw).trim();
      data[key] = text ? text.slice(0, key === "notes" ? 300 : 120) : null;
    }
    const missing = REQUIRED.filter((k) => !data[k]);
    if (missing.length) {
      throw new ValidationError(`Completá: ${missing.map((k) => LABELS[k]).join(", ")}`);
    }
    if (data.phone.replace(/\D/g, "").length < 8) throw new ValidationError("El teléfono no es válido");
    const zones = await this.zoneNames();
    if (!zones.includes(data.zone)) {
      throw new ValidationError(`Departamento inválido. Opciones: ${zones.join(", ")}`);
    }
    try {
      return await this.prisma.userAddress.upsert({
        where: { userSuperTokensId: userId },
        update: data,
        create: { ...data, userSuperTokensId: userId },
      });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  // ------------------------------------------------------------ Cotización

  private unavailable(reason: string, zone: string | null = null): ShippingQuote {
    return { available: false, provider: null, price: 0, currency: "ARS", etaMinutes: null, zone, providerQuoteId: null, reason };
  }

  /**
   * Cotiza el envío al domicilio guardado del usuario.
   * @param orderValue valor de los productos (lo usa Uber como valor declarado).
   */
  async quoteForUser(userId: string, orderValue?: number): Promise<ShippingQuote> {
    const address = await this.getAddress(userId);
    if (!address) return this.unavailable("Configurá tu domicilio para calcular el envío.");
    return this.quoteForAddress(address, orderValue);
  }

  async quoteForAddress(address: any, orderValue?: number): Promise<ShippingQuote> {
    const zone = await this.prisma.shippingZone.findUnique({ where: { name: address.zone } });

    if (isUberConfigured()) {
      try {
        const pickup = pickupInfo();
        const q = await uberQuote({
          pickup: pickup.address,
          pickupPhone: pickup.phone,
          dropoff: dropoffAddress(address),
          dropoffPhone: address.phone,
          value: orderValue,
        });
        if (q.currency === "ARS" && q.fee >= 0) {
          return {
            available: true,
            provider: "uber",
            price: round2(q.fee),
            currency: "ARS",
            etaMinutes: q.durationMinutes,
            zone: address.zone,
            providerQuoteId: q.id,
            reason: null,
          };
        }
        console.warn(`[shipping] cotización de Uber en ${q.currency}: se usa la tarifa propia`);
      } catch (err: any) {
        console.warn("[shipping] Uber no cotizó, se usa la tarifa propia:", err.message);
      }
    }

    if (!zone || !zone.active) {
      return this.unavailable(`Por ahora no hacemos envíos a ${address.zone}. Podés retirar tu pedido en el local.`, address.zone);
    }
    return {
      available: true,
      provider: "own",
      price: round2(zone.price),
      currency: "ARS",
      etaMinutes: zone.etaMinutes ?? null,
      zone: zone.name,
      providerQuoteId: null,
      reason: null,
    };
  }

  /** Para el checkout: cotiza y falla con un mensaje claro si no se puede enviar. */
  async requireQuote(userId: string, orderValue?: number) {
    const address = await this.getAddress(userId);
    if (!address) throw new ValidationError("Configurá tu domicilio para elegir envío a domicilio.");
    const quote = await this.quoteForAddress(address, orderValue);
    if (!quote.available) throw new ValidationError(quote.reason ?? "No hacemos envíos a ese domicilio.");
    return { quote, address };
  }

  async getZoneOrFail(id: number) {
    const zone = await this.prisma.shippingZone.findUnique({ where: { id } });
    if (!zone) throw new NotFoundError("Zona no encontrada");
    return zone;
  }
}
