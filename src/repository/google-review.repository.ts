import { prisma } from "../config/prisma/client.js";
import { translatePrismaError } from "../errors/infra/translatePrismaError.js";

const run = <R>(fn: () => Promise<R>): Promise<R> =>
  fn().catch((error) => {
    throw translatePrismaError(error);
  });

export type GoogleReviewInput = {
  googleId: string;
  authorName: string;
  authorPhotoUrl: string | null;
  authorUrl: string | null;
  rating: number;
  text: string | null;
  language: string | null;
  relativeTime: string | null;
  publishedAt: Date | null;
};

export class GoogleReviewRepository {
  private prisma = prisma;

  findPlace(placeId: string) {
    return run(() => this.prisma.googlePlace.findUnique({ where: { placeId } }));
  }

  /** Último lugar sincronizado (cuando el Place ID se resolvió por búsqueda). */
  latestPlace() {
    return run(() =>
      this.prisma.googlePlace.findFirst({ orderBy: { lastSyncAt: { sort: "desc", nulls: "last" } } }),
    );
  }

  savePlace(placeId: string, data: Record<string, any>) {
    return run(() =>
      this.prisma.googlePlace.upsert({
        where: { placeId },
        create: { placeId, ...data },
        update: data,
      }),
    );
  }

  list(onlyPublic: boolean) {
    return run(() =>
      this.prisma.googleReview.findMany({
        where: onlyPublic ? { featured: true, active: true } : undefined,
        orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      }),
    );
  }

  /**
   * Inserta o actualiza por id de Google. Las reseñas NUEVAS de 4-5 estrellas
   * quedan destacadas por defecto; las existentes conservan lo que eligió el staff.
   */
  upsertMany(reviews: GoogleReviewInput[]) {
    const now = new Date();
    return run(() =>
      this.prisma.$transaction(
        reviews.map((r) =>
          this.prisma.googleReview.upsert({
            where: { googleId: r.googleId },
            create: { ...r, featured: r.rating >= 4, fetchedAt: now },
            update: { ...r, fetchedAt: now },
          }),
        ),
      ),
    );
  }

  update(id: number, data: { featured?: boolean; active?: boolean }) {
    return run(() => this.prisma.googleReview.update({ where: { id: Number(id) }, data }));
  }
}
