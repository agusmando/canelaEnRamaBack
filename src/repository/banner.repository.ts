import { GenericRepositoryImpl, type SearchResult } from "./generic.repository.js";
import { BannerDto, type BannerInput } from "../dto/banner/banner.dto.js";
import { prismaQueryBuilder } from "../utils/prismaQueryBuilder.js";
import { translatePrismaError } from "../errors/infra/translatePrismaError.js";

const bannerSearchMapping = {
  placement: { field: "placement", type: "enum" },
  active: { field: "active", type: "boolean" },
  name: { field: "name", type: "string" },
};

const ORDER = [{ placement: "asc" as const }, { position: "asc" as const }, { id: "asc" as const }];

export class BannerRepository extends GenericRepositoryImpl<BannerDto, BannerInput, BannerInput> {
  constructor() {
    super("banner");
  }

  private run<R>(fn: () => Promise<R>): Promise<R> {
    return fn().catch((error) => {
      throw translatePrismaError(error);
    });
  }

  async search(
    filters: any,
    paginate: boolean,
    currentPage: number,
    amountPerPage: number,
  ): Promise<SearchResult<BannerDto>> {
    const where = prismaQueryBuilder(filters, bannerSearchMapping);
    const page = Math.max(1, Number(currentPage) || 1);
    const perPage = Math.min(100, Math.max(1, Number(amountPerPage) || 10));
    const query: any = { where, orderBy: ORDER };
    if (paginate) {
      query.take = perPage;
      query.skip = (page - 1) * perPage;
    }
    return this.run(async () => {
      const [totalElements, entityList] = await Promise.all([
        this.prisma.banner.count({ where }),
        this.prisma.banner.findMany(query),
      ]);
      return { entityList: entityList as any, currentPage: page, amountPerPage: perPage, totalElements };
    });
  }

  /** Banners vigentes ahora (activos y dentro del rango de fechas). */
  listLive(placement?: string) {
    const now = new Date();
    return this.run(() =>
      this.prisma.banner.findMany({
        where: {
          active: true,
          ...(placement ? { placement: placement as any } : {}),
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
        orderBy: ORDER,
      }),
    );
  }

  findRaw(id: number) {
    return this.run(() => this.prisma.banner.findUnique({ where: { id: Number(id) } }));
  }

  nextPosition(placement: string) {
    return this.run(async () => {
      const agg = await this.prisma.banner.aggregate({
        where: { placement: placement as any },
        _max: { position: true },
      });
      return (agg._max.position ?? -1) + 1;
    });
  }

  createBanner(data: Record<string, any>) {
    return this.run(() => this.prisma.banner.create({ data: data as any }));
  }

  updateBanner(id: number, data: Record<string, any>) {
    return this.run(() => this.prisma.banner.update({ where: { id: Number(id) }, data }));
  }

  deleteBanner(id: number) {
    return this.run(() => this.prisma.banner.delete({ where: { id: Number(id) } }));
  }

  findMany(ids: number[]) {
    return this.run(() => this.prisma.banner.findMany({ where: { id: { in: ids } } }));
  }

  reorder(ids: number[]) {
    return this.run(() =>
      this.prisma.$transaction(
        ids.map((id, position) =>
          this.prisma.banner.update({ where: { id }, data: { position } }),
        ),
      ),
    );
  }
}
