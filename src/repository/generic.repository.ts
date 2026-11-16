import { PrismaClient } from "@prisma/client";
import { prisma as sharedPrisma, type DbClient } from "../config/prisma/client.js";
import { prismaQueryBuilder } from "../utils/prismaQueryBuilder.js";
import type { GenericRepositoryInterface } from "./generic-repository.interface.js";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.js";
import { prismaUpdateEntityBuilder } from "../utils/prismaUpdateEntityBuilder.js";
import mappingSelector from "../utils/mappingSelector.js";
import { translatePrismaError } from "../errors/infra/translatePrismaError.js";

type EntityMappings = {
  search?: any;
  create?: any;
  update?: any;
  post?: (entity: any) => any;
};

export type RepositoryOptions = {
  /** Orden por defecto de los listados. `null` para modelos sin `id` (ej. CartItem). */
  orderBy?: Record<string, "asc" | "desc"> | null;
};

export type SearchResult<T> = {
  entityList: T[];
  currentPage: number;
  amountPerPage: number;
  totalElements: number;
};

/**
 * Repositorio CRUD genérico basado en "mappings" declarativos.
 *
 * Se puede usar directamente (`new GenericRepositoryImpl("tag")`) o extender
 * para agregar consultas propias. Todas las operaciones aceptan un `tx` para
 * participar de una transacción abierta por el servicio.
 */
export class GenericRepositoryImpl<T, U, V>
  implements GenericRepositoryInterface<T, U, V>
{
  /** Cliente compartido. Las subclases lo usan para consultas propias. */
  protected prisma: PrismaClient = sharedPrisma;
  protected readonly prismaName: string;
  private readonly orderBy: Record<string, "asc" | "desc"> | null;
  private mappingsPromise?: Promise<EntityMappings>;

  constructor(prismaName: string, options: RepositoryOptions = {}) {
    this.prismaName = prismaName;
    this.orderBy = options.orderBy === undefined ? { id: "asc" } : options.orderBy;
  }

  /** Delegate de Prisma del modelo (ej. prisma.product), dentro o fuera de tx. */
  protected model(tx?: DbClient): any {
    const client: any = tx ?? this.prisma;
    const delegate = client[this.prismaName];
    if (!delegate) {
      throw new Error(`Prisma model "${this.prismaName}" not found`);
    }
    return delegate;
  }

  /** @deprecated usar `model(tx)`. Se mantiene por compatibilidad. */
  async ensureModel(_type?: "search" | "create" | "update", tx?: any) {
    return this.model(tx);
  }

  /** Carga (una sola vez) los mappings del modelo. */
  protected getMappings(): Promise<EntityMappings> {
    if (!this.mappingsPromise) {
      const selected: any = mappingSelector(this.prismaName) ?? {};
      this.mappingsPromise = Promise.all([
        selected.search,
        selected.create,
        selected.update,
        selected.post,
      ]).then(([search, create, update, post]) => ({ search, create, update, post }));
    }
    return this.mappingsPromise;
  }

  protected postProcess(entity: any, post?: (e: any) => any) {
    return post && entity ? post(entity) : entity;
  }

  async create(data: any, tx?: any): Promise<any> {
    const { create, search, post } = await this.getMappings();
    const include = search ? this.includeQuery(search) : undefined;
    try {
      const entity = await this.model(tx).create({
        data: prismaCreateEntityBuilder(data, create),
        include: include && Object.keys(include).length ? include : undefined,
      });
      return this.postProcess(entity, post);
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  async update(id: number, data: any, tx?: any): Promise<any> {
    const { update, search, post } = await this.getMappings();
    const include = search ? this.includeQuery(search) : undefined;
    const updateData = prismaUpdateEntityBuilder(data, update);

    if (!updateData || Object.keys(updateData).length === 0) {
      return this.getById(id, tx);
    }
    try {
      const entity = await this.model(tx).update({
        where: { id: Number(id) },
        data: updateData,
        include: include && Object.keys(include).length ? include : undefined,
      });
      return this.postProcess(entity, post);
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  async search(
    filters: any,
    paginate: boolean,
    currentPage: number,
    amountPerPage: number,
    detalle: boolean,
    tx?: any,
  ): Promise<SearchResult<T>> {
    const { search, post } = await this.getMappings();
    const where = prismaQueryBuilder(filters, search ?? {});

    const query: any = { where };
    if (this.orderBy) query.orderBy = this.orderBy;

    if (detalle && search) {
      const include = this.includeQuery(search);
      if (Object.keys(include).length > 0) query.include = include;
    }

    const page = Math.max(1, Number(currentPage) || 1);
    const perPage = Math.min(100, Math.max(1, Number(amountPerPage) || 10));
    if (paginate) {
      query.take = perPage;
      query.skip = (page - 1) * perPage;
    }

    try {
      const model = this.model(tx);
      const [totalElements, rows] = await Promise.all([
        model.count({ where }),
        model.findMany(query),
      ]);
      const entityList = (rows as any[]).map((e) => this.postProcess(e, post));
      return { entityList, currentPage: page, amountPerPage: perPage, totalElements };
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  async getById(id: number, tx?: any): Promise<T> {
    const { search, post } = await this.getMappings();
    const include = search ? this.includeQuery(search) : undefined;
    try {
      const entity = await this.model(tx).findFirst({
        where: { id: Number(id) },
        include: include && Object.keys(include).length ? include : undefined,
      });
      return this.postProcess(entity, post);
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  async deactivate(id: number, tx?: any): Promise<T> {
    return this.setActive(id, false, tx);
  }

  async activate(id: number, tx?: any): Promise<T> {
    return this.setActive(id, true, tx);
  }

  protected async setActive(id: number, active: boolean, tx?: any): Promise<T> {
    try {
      return await this.model(tx).update({
        where: { id: Number(id) },
        data: { active },
      });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  /** Arma el `include` de Prisma a partir de las relaciones del mapping de búsqueda. */
  includeQuery(mapping: any): Record<string, any> {
    const include: Record<string, any> = {};
    for (const key of Object.keys(mapping ?? {})) {
      const { field, type, expand } = mapping[key] ?? {};
      if (!field || !["relationArray", "object"].includes(type)) continue;
      if (!expand) {
        include[field] = true;
        continue;
      }
      const children = Array.isArray(expand) ? expand : [String(expand)];
      include[field] = {
        include: Object.fromEntries(children.filter(Boolean).map((c: string) => [c, true])),
      };
    }
    return include;
  }

  async withTransaction<R>(callback: (tx: PrismaClient) => Promise<R>): Promise<R> {
    return this.prisma.$transaction(callback as any, { timeout: 60000 }) as Promise<R>;
  }
}
