import { CreateDiscountCodeDto } from "../dto/discount-code/create-discount-code.dto.js";
import { DiscountCodeDto } from "../dto/discount-code/discount-code.dto.js";
import { UpdateDiscountCodeDto } from "../dto/discount-code/update-discount-code.dto.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { GenericServiceImpl } from "./generic-impl.service.js";
import { prisma, type DbClient } from "../config/prisma/client.js";

export const COUPON_TYPES = ["PERCENTAGE", "FIXED"] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;

// Mensaje genérico cuando el código existe pero ya no se puede usar:
// no le interesa al cliente el motivo (agotado, vencido, inactivo, etc.).
const CODE_UNAVAILABLE_MSG = "Este código de descuento ya no está vigente";

/** Lo que devuelve la validación pública de un código. */
export type CouponPreview = {
  code: string;
  discountType: string;
  discountValue: number;
  discount: number;
  minOrderAmount: number;
  finishTime: Date;
};

/**
 * Códigos de descuento de checkout (cupón sobre el subtotal de productos).
 * A diferencia de `Offer` (por producto/variante), el cliente escribe el código.
 *
 * Reglas:
 *  - PERCENTAGE: discountValue% del subtotal, con tope opcional `maxDiscountAmount`.
 *  - FIXED: $discountValue fijos, tope natural = subtotal.
 *  - `minOrderAmount`: subtotal mínimo de productos (con ofertas ya aplicadas).
 *  - `usageLimit` / `perUserLimit`: usos totales y por cliente (cuentan pedidos
 *    no cancelados que usaron el código).
 */
export class DiscountCodeService extends GenericServiceImpl<
  DiscountCodeDto,
  CreateDiscountCodeDto,
  UpdateDiscountCodeDto
> {
  constructor() {
    super("discountCode");
  }

  /** Mayúsculas, sin espacios alrededor; el resto se valida con CODE_RE. */
  static normalizeCode(code: unknown): string {
    return String(code ?? "").trim().toUpperCase();
  }

  async create(data: CreateDiscountCodeDto): Promise<any> {
    data.code = DiscountCodeService.normalizeCode(data.code);
    this.validateCode(data);
    await this.assertCodeAvailable(data.code);
    return super.create(data);
  }

  async update(id: number, data: UpdateDiscountCodeDto): Promise<any> {
    const current: any = await this.findOne(id);
    const merged = { ...current, ...data } as CreateDiscountCodeDto;
    if (data.code !== undefined) merged.code = DiscountCodeService.normalizeCode(data.code);
    this.validateCode(merged);
    if (merged.code !== current.code) await this.assertCodeAvailable(merged.code, id);
    return super.update(id, data);
  }

  private async assertCodeAvailable(code: string, excludeId?: number) {
    const existing = await prisma.discountCode.findFirst({
      where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (existing) throw new ValidationError(`Ya existe un código "${code}"`);
  }

  private validateCode(data: Partial<CreateDiscountCodeDto>) {
    const code = DiscountCodeService.normalizeCode(data.code);
    if (!CODE_RE.test(code)) {
      throw new ValidationError("El código debe tener entre 3 y 40 caracteres: letras, números, guion o guion bajo");
    }
    if (!COUPON_TYPES.includes(data.discountType as any)) {
      throw new ValidationError(`discountType debe ser uno de ${COUPON_TYPES.join(", ")}`);
    }
    const start = new Date(data.startTime as any);
    const finish = new Date(data.finishTime as any);
    if (Number.isNaN(start.getTime()) || Number.isNaN(finish.getTime()) || finish <= start) {
      throw new ValidationError("startTime y finishTime deben ser fechas válidas y finishTime > startTime");
    }
    const value = Number(data.discountValue);
    if (data.discountType === "PERCENTAGE" && !(value > 0 && value <= 100)) {
      throw new ValidationError("discountValue debe estar entre 0 y 100 para descuentos porcentuales");
    }
    if (data.discountType === "FIXED" && !(value > 0)) {
      throw new ValidationError("discountValue debe ser mayor a 0");
    }
    for (const [field, label] of [
      ["maxDiscountAmount", "maxDiscountAmount"],
      ["minOrderAmount", "minOrderAmount"],
    ] as const) {
      const n = data[field];
      if (n != null && n !== ("" as any) && !(Number(n) >= 0)) {
        throw new ValidationError(`${label} debe ser mayor o igual a 0`);
      }
    }
    for (const field of ["usageLimit", "perUserLimit"] as const) {
      const n = data[field];
      if (n != null && n !== ("" as any) && !(Number.isInteger(Number(n)) && Number(n) > 0)) {
        throw new ValidationError(`${field} debe ser un entero mayor a 0 (o vacío para ilimitado)`);
      }
    }
  }

  /** Monto de descuento que genera el código sobre un subtotal de productos. */
  discountFor(dc: any, subtotal: number): number {
    const base = Math.max(0, Number(subtotal) || 0);
    let discount =
      dc.discountType === "PERCENTAGE" ? (base * Number(dc.discountValue)) / 100 : Number(dc.discountValue);
    if (dc.maxDiscountAmount != null) discount = Math.min(discount, Number(dc.maxDiscountAmount));
    return round2(Math.min(discount, base));
  }

  /**
   * Busca el código y verifica que sea usable por `userId` sobre `subtotal`.
   * Lanza ValidationError con mensaje para el cliente si no aplica.
   */
  private async usableCode(codeRaw: unknown, subtotal: number, userId: string | undefined, tx?: DbClient) {
    const code = DiscountCodeService.normalizeCode(codeRaw);
    if (!code) return null;
    const client = (tx ?? prisma) as any;
    const dc = await client.discountCode.findUnique({ where: { code } });
    if (!dc) throw new ValidationError("El código de descuento no es válido");

    const now = new Date();
    if (!dc.active) throw new ValidationError(CODE_UNAVAILABLE_MSG);
    if (new Date(dc.startTime) > now || new Date(dc.finishTime) < now) {
      throw new ValidationError(CODE_UNAVAILABLE_MSG);
    }
    const base = Math.max(0, Number(subtotal) || 0);
    if (base <= 0) throw new ValidationError("El código se aplica sobre el total de productos");
    if (Number(dc.minOrderAmount) > 0 && base < Number(dc.minOrderAmount)) {
      throw new ValidationError(
        `Este código requiere una compra mínima de $${Number(dc.minOrderAmount).toLocaleString("es-AR")}`,
      );
    }
    if (dc.usageLimit != null && Number(dc.usedCount) >= Number(dc.usageLimit)) {
      throw new ValidationError(CODE_UNAVAILABLE_MSG);
    }
    if (dc.perUserLimit != null && userId) {
      const used = await client.order.count({
        where: { couponCode: code, userSuperTokensId: userId, status: { not: "CANCELLED" } },
      });
      if (used >= Number(dc.perUserLimit)) {
        throw new ValidationError(CODE_UNAVAILABLE_MSG);
      }
    }
    return dc;
  }

  /**
   * Vista previa para el checkout: mismo criterio que `resolveForOrder` pero
   * sin consumir uso ni tocar la orden.
   */
  async preview(codeRaw: unknown, subtotalRaw: unknown, userId?: string): Promise<CouponPreview> {
    const dc = await this.usableCode(codeRaw, Number(subtotalRaw) || 0, userId);
    if (!dc) throw new ValidationError("Ingresá un código de descuento");
    return {
      code: dc.code,
      discountType: dc.discountType,
      discountValue: Number(dc.discountValue),
      discount: this.discountFor(dc, Number(subtotalRaw) || 0),
      minOrderAmount: Number(dc.minOrderAmount) || 0,
      finishTime: dc.finishTime,
    };
  }

  /**
   * Resuelve el cupón para una orden nueva (dentro de la transacción).
   * Devuelve null si no vino código; si vino y no sirve, lanza ValidationError.
   * Incrementa `usedCount` para que el límite total se respete.
   */
  async resolveForOrder(
    codeRaw: unknown,
    subtotal: number,
    userId: string,
    tx?: DbClient,
  ): Promise<{
    id: number;
    code: string;
    discount: number;
    params: {
      discountType: string;
      discountValue: number;
      maxDiscountAmount: number | null;
      minOrderAmount: number;
    };
  } | null> {
    const dc = await this.usableCode(codeRaw, subtotal, userId, tx);
    if (!dc) return null;
    const discount = this.discountFor(dc, subtotal);
    if (!(discount > 0)) return null;
    await (tx as any).discountCode.update({
      where: { id: dc.id },
      data: { usedCount: { increment: 1 } },
    });
    return {
      id: dc.id,
      code: dc.code,
      discount,
      params: {
        discountType: dc.discountType,
        discountValue: Number(dc.discountValue),
        maxDiscountAmount: dc.maxDiscountAmount != null ? Number(dc.maxDiscountAmount) : null,
        minOrderAmount: Number(dc.minOrderAmount) || 0,
      },
    };
  }
}
