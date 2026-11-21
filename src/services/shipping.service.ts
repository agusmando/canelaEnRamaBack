import { BadRequestError } from "../errors/application/BadRequestError.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { prisma, type DbClient } from "../config/prisma/client.js";

export const DEFAULT_SHIPPING_DEPARTMENTS = [
  "Godoy Cruz",
  "Capital",
  "Guaymallén",
  "Las Heras",
  "Luján",
  "Maipú",
];

export type ShippingQuoteZone = { name: string; price: number; etaMinutes: number | null };

export function quoteShippingZone(zone: ShippingQuoteZone | null, requestedZone: string | null) {
  if (!requestedZone) {
    return {
      available: false,
      provider: null,
      price: 0,
      currency: "ARS" as const,
      etaMinutes: null,
      zone: null,
      providerQuoteId: null,
      reason: "Guardá un domicilio para calcular el envío",
    };
  }
  if (!zone) {
    return {
      available: false,
      provider: null,
      price: 0,
      currency: "ARS" as const,
      etaMinutes: null,
      zone: requestedZone,
      providerQuoteId: null,
      reason: "Todavía no tenemos envíos habilitados para este departamento",
    };
  }
  return {
    available: true,
    provider: "own" as const,
    price: zone.price,
    currency: "ARS" as const,
    etaMinutes: zone.etaMinutes,
    zone: zone.name,
    providerQuoteId: null,
    reason: null,
  };
}

const PICKUP = {
  name: "Canela en Rama",
  address: "Colombia 1268, Godoy Cruz, Mendoza",
};

const MAX_TEXT_LENGTH = 300;
const cleanText = (value: unknown, field: string, required = false, max = MAX_TEXT_LENGTH) => {
  if (value === undefined || value === null) {
    if (required) throw new ValidationError(`${field} es obligatorio`);
    return null;
  }
  if (typeof value !== "string") throw new ValidationError(`${field} debe ser texto`);
  const text = value.trim();
  if (required && !text) throw new ValidationError(`${field} es obligatorio`);
  if (text.length > max) throw new ValidationError(`${field} no puede superar ${max} caracteres`);
  return text || null;
};

export type ShippingZoneInput = {
  name?: unknown;
  price?: unknown;
  etaMinutes?: unknown;
  active?: unknown;
  sortOrder?: unknown;
};

export type UserAddressInput = {
  recipientName?: unknown;
  phone?: unknown;
  street?: unknown;
  number?: unknown;
  apartment?: unknown;
  zone?: unknown;
  city?: unknown;
  postalCode?: unknown;
  notes?: unknown;
};

export class ShippingService {
  async config(db: DbClient = prisma) {
    const [activeZones, allZones] = await Promise.all([
      db.shippingZone.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { name: true, price: true, etaMinutes: true },
      }),
      db.shippingZone.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { name: true },
      }),
    ]);
    const departments = [
      ...DEFAULT_SHIPPING_DEPARTMENTS,
      ...allZones.map((zone) => zone.name).filter((name) =>
        !DEFAULT_SHIPPING_DEPARTMENTS.some((department) => department.toLocaleLowerCase("es") === name.toLocaleLowerCase("es")),
      ),
    ];
    return {
      zones: activeZones,
      departments,
      providers: { uber: false },
      pickup: PICKUP,
      methods: ["DELIVERY", "PICKUP"],
      deliveryEnabled: true,
      pickupEnabled: true,
      carrierTrackingSupported: true,
    };
  }

  async listZones(db: DbClient = prisma) {
    return db.shippingZone.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  }

  async createZone(input: ShippingZoneInput, db: DbClient = prisma) {
    const data = this.parseZone(input, true);
    await this.ensureUniqueZoneName(data.name, undefined, db);
    return db.shippingZone.create({ data });
  }

  async updateZone(id: number, input: ShippingZoneInput, db: DbClient = prisma) {
    const current = await db.shippingZone.findUnique({ where: { id } });
    if (!current) throw new NotFoundError("Zona de envío no encontrada");
    const data = this.parseZone(input, false);
    if (data.name) await this.ensureUniqueZoneName(data.name, id, db);
    if (!Object.keys(data).length) return current;
    return db.shippingZone.update({ where: { id }, data });
  }

  async getAddress(userId: string, db: DbClient = prisma) {
    return db.userAddress.findUnique({ where: { userSuperTokensId: userId } });
  }

  async saveAddress(userId: string, input: UserAddressInput, db: DbClient = prisma) {
    if (!userId) throw new BadRequestError("Se requiere una sesión para guardar el domicilio");
    const recipientName = cleanText(input.recipientName, "recipientName", true, 120)!;
    const phone = cleanText(input.phone, "phone", true, 60)!;
    if (phone.replace(/\D/g, "").length < 6) throw new ValidationError("phone debe tener al menos 6 dígitos");
    const street = cleanText(input.street, "street", true, 160)!;
    const number = cleanText(input.number, "number", true, 40)!;
    const zoneInput = cleanText(input.zone, "zone", true, 120)!;
    const zone = await db.shippingZone.findFirst({
      where: { name: { equals: zoneInput, mode: "insensitive" } },
      select: { name: true },
    });
    const normalizedZone =
      zone?.name ??
      DEFAULT_SHIPPING_DEPARTMENTS.find((name) => name.toLocaleLowerCase("es") === zoneInput.toLocaleLowerCase("es"));
    if (!normalizedZone) throw new ValidationError("zone no es un departamento de envío válido");

    return db.userAddress.upsert({
      where: { userSuperTokensId: userId },
      create: {
        userSuperTokensId: userId,
        recipientName,
        phone,
        street,
        number,
        apartment: cleanText(input.apartment, "apartment"),
        zone: normalizedZone,
        city: cleanText(input.city, "city", false, 120),
        postalCode: cleanText(input.postalCode, "postalCode", false, 30),
        notes: cleanText(input.notes, "notes"),
      },
      update: {
        recipientName,
        phone,
        street,
        number,
        apartment: cleanText(input.apartment, "apartment"),
        zone: normalizedZone,
        city: cleanText(input.city, "city", false, 120),
        postalCode: cleanText(input.postalCode, "postalCode", false, 30),
        notes: cleanText(input.notes, "notes"),
      },
    });
  }

  async quote(userId: string, rawValue: unknown, db: DbClient = prisma) {
    if (typeof rawValue !== "string" && typeof rawValue !== "number") {
      throw new ValidationError("value debe ser un importe numérico mayor o igual a cero");
    }
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < 0) {
      throw new ValidationError("value debe ser un importe numérico mayor o igual a cero");
    }
    if (!userId) throw new BadRequestError("Se requiere una sesión para cotizar el envío");
    const address = await db.userAddress.findUnique({ where: { userSuperTokensId: userId } });
    if (!address) return quoteShippingZone(null, null);

    const zone = await db.shippingZone.findFirst({
      where: { name: { equals: address.zone, mode: "insensitive" }, active: true },
    });
    return quoteShippingZone(zone, address.zone);
  }

  private parseZone(input: ShippingZoneInput, required: true): {
    name: string;
    price: number;
    etaMinutes: number | null;
    active?: boolean;
    sortOrder: number;
  };
  private parseZone(input: ShippingZoneInput, required: false): {
    name?: string;
    price?: number;
    etaMinutes?: number | null;
    active?: boolean;
    sortOrder?: number;
  };
  private parseZone(input: ShippingZoneInput, required: boolean) {
    const data: { name?: string; price?: number; etaMinutes?: number | null; active?: boolean; sortOrder?: number } = {};
    if (input.name !== undefined || required) data.name = cleanText(input.name, "name", true, 120)!;
    if (input.price !== undefined || required) {
      const price = Number(input.price);
      if (!Number.isFinite(price) || price < 0) throw new ValidationError("price debe ser un número mayor o igual a cero");
      data.price = Math.round(price * 100) / 100;
    }
    if (input.etaMinutes !== undefined || required) {
      if (input.etaMinutes === null || input.etaMinutes === "") {
        data.etaMinutes = null;
      } else {
        const etaMinutes = Number(input.etaMinutes);
        if (!Number.isInteger(etaMinutes) || etaMinutes <= 0) {
          throw new ValidationError("etaMinutes debe ser un entero mayor a cero o null");
        }
        data.etaMinutes = etaMinutes;
      }
    }
    if (input.active !== undefined) {
      if (typeof input.active !== "boolean") throw new ValidationError("active debe ser booleano");
      data.active = input.active;
    }
    if (input.sortOrder !== undefined || required) {
      const sortOrder = input.sortOrder === undefined ? 0 : Number(input.sortOrder);
      if (!Number.isInteger(sortOrder) || sortOrder < 0) throw new ValidationError("sortOrder debe ser un entero mayor o igual a cero");
      data.sortOrder = sortOrder;
    }
    return data;
  }

  private async ensureUniqueZoneName(name: string, excludedId: number | undefined, db: DbClient) {
    const existing = await db.shippingZone.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        ...(excludedId === undefined ? {} : { NOT: { id: excludedId } }),
      },
      select: { id: true },
    });
    if (existing) throw new ValidationError("Ya existe una zona con ese nombre");
  }
}
