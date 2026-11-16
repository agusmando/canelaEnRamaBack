import { GenericRepositoryImpl } from "./generic.repository.js";
import { CreateReviewDto, ReviewDto, UpdateReviewDto } from "../dto/review/review.dto.js";
import { translatePrismaError } from "../errors/infra/translatePrismaError.js";

export const REVIEW_INCLUDE = {
  user: { select: { name: true, email: true } },
  productVariant: {
    select: {
      id: true,
      name: true,
      images: { select: { id: true, secure_url: true }, take: 1 },
      product: { select: { id: true, name: true } },
    },
  },
};

const ORDER_BY: Record<string, any> = {
  recent: [{ createdAt: "desc" }, { id: "desc" }],
  rating_desc: [{ rating: "desc" }, { createdAt: "desc" }],
  rating_asc: [{ rating: "asc" }, { createdAt: "desc" }],
};

export type ReviewListParams = {
  where: Record<string, any>;
  orderBy?: string;
  paginate: boolean;
  page: number;
  perPage: number;
};

export class ReviewRepository extends GenericRepositoryImpl<ReviewDto, CreateReviewDto, UpdateReviewDto> {
  constructor() {
    super("review", { orderBy: { id: "desc" } });
  }

  private run<R>(fn: () => Promise<R>): Promise<R> {
    return fn().catch((error) => {
      throw translatePrismaError(error);
    });
  }

  list({ where, orderBy = "recent", paginate, page, perPage }: ReviewListParams) {
    return this.run(async () => {
      const query: any = { where, include: REVIEW_INCLUDE, orderBy: ORDER_BY[orderBy] ?? ORDER_BY.recent };
      if (paginate) {
        query.take = perPage;
        query.skip = (page - 1) * perPage;
      }
      const [totalElements, entityList] = await Promise.all([
        this.prisma.review.count({ where }),
        this.prisma.review.findMany(query),
      ]);
      return { entityList, totalElements, currentPage: page, amountPerPage: perPage };
    });
  }

  findFull(id: number) {
    return this.run(() =>
      this.prisma.review.findUnique({ where: { id: Number(id) }, include: REVIEW_INCLUDE }),
    );
  }

  findByUserAndVariant(userSuperTokensId: string, productVariantId: number) {
    return this.run(() =>
      this.prisma.review.findUnique({
        where: { userSuperTokensId_productVariantId: { userSuperTokensId, productVariantId } },
        include: REVIEW_INCLUDE,
      }),
    );
  }

  listByUser(userSuperTokensId: string, productId?: number) {
    return this.run(() =>
      this.prisma.review.findMany({
        where: { userSuperTokensId, ...(productId ? { productId } : {}) },
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  createReview(data: Record<string, any>) {
    return this.run(() => this.prisma.review.create({ data: data as any, include: REVIEW_INCLUDE }));
  }

  updateReview(id: number, data: Record<string, any>) {
    return this.run(() =>
      this.prisma.review.update({ where: { id: Number(id) }, data, include: REVIEW_INCLUDE }),
    );
  }

  deleteReview(id: number) {
    return this.run(() => this.prisma.review.delete({ where: { id: Number(id) } }));
  }

  /** Promedio y conteo por variante y por estrella (solo APROBADAS). */
  summary(productId: number) {
    return this.run(async () => {
      const where = { productId, status: "APPROVED" as const };
      const [byRating, byVariant] = await Promise.all([
        this.prisma.review.groupBy({ by: ["rating"], where, _count: { _all: true } }),
        this.prisma.review.groupBy({
          by: ["productVariantId"],
          where,
          _count: { _all: true },
          _avg: { rating: true },
        }),
      ]);
      return { byRating, byVariant };
    });
  }

  stats() {
    return this.run(async () => {
      const [byStatus, avg] = await Promise.all([
        this.prisma.review.groupBy({ by: ["status"], _count: { _all: true } }),
        this.prisma.review.aggregate({ where: { status: "APPROVED" }, _avg: { rating: true } }),
      ]);
      return { byStatus, average: avg._avg.rating ?? 0 };
    });
  }

  /**
   * Para cada variante, la orden ENTREGADA más reciente del usuario que la
   * incluye (ítem no cancelado ni devuelto por completo).
   */
  deliveredPurchases(userSuperTokensId: string, filter: { productId?: number; productVariantId?: number }) {
    return this.run(() =>
      this.prisma.orderItem.findMany({
        where: {
          status: { notIn: ["CANCELLED", "RETURNED"] },
          productVariantId: filter.productVariantId ?? { not: null },
          ...(filter.productId ? { productVariant: { productId: filter.productId } } : {}),
          Order: { userSuperTokensId, status: "DELIVERED" },
        },
        select: {
          orderId: true,
          productVariantId: true,
          productVariant: { select: { id: true, name: true, productId: true } },
        },
        orderBy: { orderId: "desc" },
      }),
    );
  }
}
