import { GenericServiceImpl } from "./generic-impl.service.js";
import {
  CreateReviewDto,
  ModerateReviewDto,
  REVIEW_STATUSES,
  ReviewDto,
  UpdateReviewDto,
} from "../dto/review/review.dto.js";
import { ReviewRepository } from "../repository/review.repository.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";
import { ConflictError } from "../errors/application/ConflictError.js";
import { ForbidenError } from "../errors/domain/auth/ForbidenError.js";
import type { Actor } from "../middleware/auth.middleware.js";

const MAX_TITLE = 120;
const MAX_COMMENT = 1000;
const MAX_REPLY = 1000;

/** "María José González" → "María G." (no exponemos nombre completo ni email). */
export const publicAuthorName = (name?: string | null) => {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Cliente";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

const optionalId = (value: unknown, name: string) => {
  if (value === undefined || value === null || value === "") return undefined;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError(`${name} inválido`);
  return id;
};

/**
 * Opiniones de productos por variante.
 *   - Solo puede opinar quien tiene un pedido ENTREGADO con esa variante.
 *   - Una opinión por usuario y variante. Nuevas o editadas quedan PENDIENTES.
 *   - El público solo ve las APROBADAS, sin email ni nombre completo.
 */
export class ReviewService extends GenericServiceImpl<ReviewDto, CreateReviewDto, UpdateReviewDto> {
  constructor(private readonly reviewRepository = new ReviewRepository()) {
    super(reviewRepository);
  }

  /** Da forma a la respuesta según quién la pide. */
  private present(review: any, view: "public" | "owner" | "staff") {
    if (!review) return review;
    const { user, userSuperTokensId, orderId, rejectionReason, ...rest } = review;
    const out: any = { ...rest, authorName: publicAuthorName(user?.name), verifiedPurchase: true };
    if (view !== "public") out.rejectionReason = rejectionReason ?? null;
    if (view === "staff") {
      out.user = user ?? null;
      out.orderId = orderId ?? null;
    }
    return out;
  }

  async list(query: any, actor: Actor) {
    const where: Record<string, any> = {};
    const productId = optionalId(query.productId, "productId");
    const productVariantId = optionalId(query.productVariantId, "productVariantId");
    if (productId) where.productId = productId;
    if (productVariantId) where.productVariantId = productVariantId;

    if (query.rating !== undefined && query.rating !== "") {
      const rating = Number(query.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new ValidationError("rating debe ser un entero entre 1 y 5");
      }
      where.rating = rating;
    }

    if (actor.isStaff) {
      if (query.status) {
        const status = String(query.status).toUpperCase();
        if (!REVIEW_STATUSES.includes(status as any)) {
          throw new ValidationError(`status debe ser uno de ${REVIEW_STATUSES.join(", ")}`);
        }
        where.status = status;
      }
      const search = String(query.search ?? "").trim();
      if (search) {
        const contains = { contains: search, mode: "insensitive" };
        where.OR = [
          { title: contains },
          { comment: contains },
          { user: { name: contains } },
          { user: { email: contains } },
          { productVariant: { product: { name: contains } } },
        ];
      }
    } else {
      where.status = "APPROVED";
    }

    const paginate = ["true", "1"].includes(String(query.paginate).toLowerCase());
    const page = Math.max(1, Number(query.currentPage) || 1);
    const perPage = Math.min(50, Math.max(1, Number(query.amountPerPage) || 10));
    const result = await this.reviewRepository.list({
      where,
      orderBy: query.orderBy,
      paginate,
      page,
      perPage,
    });
    const view = actor.isStaff ? "staff" : "public";
    return { ...result, entityList: result.entityList.map((r: any) => this.present(r, view)) };
  }

  async summary(productIdRaw: unknown) {
    const productId = optionalId(productIdRaw, "productId");
    if (!productId) throw new ValidationError("productId es obligatorio");
    const { byRating, byVariant } = await this.reviewRepository.summary(productId);

    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let count = 0;
    let total = 0;
    for (const row of byRating as any[]) {
      const n = row._count._all;
      distribution[row.rating as 1 | 2 | 3 | 4 | 5] = n;
      count += n;
      total += row.rating * n;
    }
    return {
      productId,
      average: count ? round1(total / count) : 0,
      count,
      distribution,
      byVariant: (byVariant as any[]).map((v) => ({
        productVariantId: v.productVariantId,
        average: round1(v._avg.rating ?? 0),
        count: v._count._all,
      })),
    };
  }

  async stats() {
    const { byStatus, average } = await this.reviewRepository.stats();
    const counts: Record<string, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    for (const row of byStatus as any[]) counts[row.status] = row._count._all;
    return {
      pending: counts.PENDING,
      approved: counts.APPROVED,
      rejected: counts.REJECTED,
      average: round1(average),
    };
  }

  async mine(userId: string) {
    const reviews = await this.reviewRepository.listByUser(userId);
    return reviews.map((r: any) => this.present(r, "owner"));
  }

  /** Variantes del producto que el usuario compró (pedido entregado) y su opinión, si ya dejó una. */
  async eligible(userId: string, productIdRaw: unknown) {
    const productId = optionalId(productIdRaw, "productId");
    if (!productId) throw new ValidationError("productId es obligatorio");
    const [purchases, reviews] = await Promise.all([
      this.reviewRepository.deliveredPurchases(userId, { productId }),
      this.reviewRepository.listByUser(userId, productId),
    ]);
    const seen = new Map<number, { productVariantId: number; variantName: string; review: any }>();
    for (const p of purchases as any[]) {
      if (!p.productVariantId || seen.has(p.productVariantId)) continue;
      const review = reviews.find((r: any) => r.productVariantId === p.productVariantId);
      seen.set(p.productVariantId, {
        productVariantId: p.productVariantId,
        variantName: p.productVariant?.name ?? "",
        review: review ? this.present(review, "owner") : null,
      });
    }
    return [...seen.values()];
  }

  async createReview(data: CreateReviewDto, userId: string) {
    const productVariantId = optionalId(data?.productVariantId, "productVariantId");
    if (!productVariantId) throw new ValidationError("productVariantId es obligatorio");
    const fields = this.parseContent(data, true);

    const purchases: any[] = await this.reviewRepository.deliveredPurchases(userId, { productVariantId });
    if (purchases.length === 0) {
      throw new ForbidenError(
        "Solo podés opinar sobre productos que compraste, una vez entregado el pedido",
      );
    }
    if (await this.reviewRepository.findByUserAndVariant(userId, productVariantId)) {
      throw new ConflictError("Ya dejaste una opinión para este producto. Podés editarla.");
    }
    const review = await this.reviewRepository.createReview({
      ...fields,
      productVariantId,
      productId: purchases[0].productVariant.productId,
      userSuperTokensId: userId,
      orderId: purchases[0].orderId,
      status: "PENDING",
    });
    return this.present(review, "owner");
  }

  /** El autor edita su opinión: vuelve a moderación. */
  async updateReview(id: number, data: UpdateReviewDto, actor: Actor) {
    const review: any = await this.reviewRepository.findFull(id);
    if (!review || review.userSuperTokensId !== actor.userId) throw new NotFoundError();
    const fields = this.parseContent(data, false);
    if (Object.keys(fields).length === 0) return this.present(review, "owner");
    const updated = await this.reviewRepository.updateReview(id, {
      ...fields,
      status: "PENDING",
      rejectionReason: null,
      moderatedAt: null,
    });
    return this.present(updated, "owner");
  }

  async moderate(id: number, data: ModerateReviewDto) {
    const review: any = await this.reviewRepository.findFull(id);
    if (!review) throw new NotFoundError();
    const status = String(data?.status ?? "").toUpperCase();
    if (status !== "APPROVED" && status !== "REJECTED") {
      throw new ValidationError("status debe ser APPROVED o REJECTED");
    }
    const fields: Record<string, any> = { status, moderatedAt: new Date() };
    fields.rejectionReason =
      status === "REJECTED" ? this.cleanText(data.rejectionReason, MAX_REPLY) : null;
    if (data && "reply" in data) {
      fields.reply = this.cleanText(data.reply, MAX_REPLY);
      fields.repliedAt = fields.reply ? new Date() : null;
    }
    return this.present(await this.reviewRepository.updateReview(id, fields), "staff");
  }

  async remove(id: number, actor: Actor) {
    const review: any = await this.reviewRepository.findFull(id);
    if (!review || (!actor.isStaff && review.userSuperTokensId !== actor.userId)) {
      throw new NotFoundError();
    }
    await this.reviewRepository.deleteReview(id);
  }

  private cleanText(value: unknown, max: number): string | null {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    if (text.length > max) throw new ValidationError(`El texto no puede superar ${max} caracteres`);
    return text || null;
  }

  private parseContent(data: any, isCreate: boolean) {
    const out: Record<string, any> = {};
    if (isCreate || data?.rating !== undefined) {
      const rating = Number(data?.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new ValidationError("rating debe ser un entero entre 1 y 5");
      }
      out.rating = rating;
    }
    if (data && "title" in data) out.title = this.cleanText(data.title, MAX_TITLE);
    if (data && "comment" in data) out.comment = this.cleanText(data.comment, MAX_COMMENT);
    return out;
  }
}
