import { PrismaClient } from "@prisma/client";
import { prismaQueryBuilder } from "../utils/prismaQueryBuilder.js";
import type { GenericRepositoryInterface } from "./generic-repository.interface.js";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.js";
import { prismaUpdateEntityBuilder } from "../utils/prismaUpdateEntityBuilder.js";
import mappingSelector from "../utils/mappingSelector.js";
import { DatabaseError } from "../errors/infra/DatabaseError.js";

export class GenericRepositoryImpl<
  T,
  U,
  V,
> implements GenericRepositoryInterface<T, U, V> {
  model: any;
  protected prisma = new PrismaClient({
    log: ["query", "info", "warn", "error"],
  });
  private prismaName: string;
  private mappingPromise: any;
  constructor(prismaName: string) {
    this.prismaName = prismaName;
    this.mappingPromise = mappingSelector(prismaName) as any;
    this.model = this.ensureModel();
  }
  async ensureModel(
    type: "search" | "create" | "update" = "search",
    tx?: PrismaClient,
  ) {
    const client = tx ?? this.prisma;
    if (this.model && !tx) return this.model;

    const mapping = this.mappingPromise
      ? await this.mappingPromise[type]
      : undefined;

    const modelName = mapping?.modelName || this.prismaName;
    const m = (client as any)[modelName];

    if (!m) console.log("Model not found:", modelName);
    if (!tx) {
      this.model = m; // solo cacheamos cuando no hay tx
    }

    return m;
  }

  async create(data: any, tx?: PrismaClient): Promise<any> {
    const mapping = this.mappingPromise
      ? await this.mappingPromise.create
      : undefined;
    const postMapping = this.mappingPromise
      ? await this.mappingPromise.post
      : undefined;
    const searchMapping = this.mappingPromise
      ? await this.mappingPromise.search
      : undefined;
    const model = await this.ensureModel("create", tx);

    const createData = prismaCreateEntityBuilder(data as any, mapping);
    let newEntity;

    // Agregar el "select" de abajo a modo de include { resultado } //algo no está funcionadno aca

    let includes = searchMapping ? this.includeQuery(searchMapping) : undefined;
    try {
      let createQuery = {
        data: createData,
        include: includes,
      };

      console.log("createQuery", createQuery);
      newEntity = await model.create({
        data: createData,
        include: includes,
      });
    } catch (error) {
      console.log("error", error);
      throw new DatabaseError();
    }

    //Post processing mapping
    if (postMapping && newEntity) {
      newEntity = postMapping(newEntity);
    }
    return newEntity;
  }
  async update(id: number, data: any, tx?: PrismaClient): Promise<any> {
    const mapping = this.mappingPromise
      ? await this.mappingPromise.update
      : undefined;
    const postMapping = this.mappingPromise
      ? await this.mappingPromise.post
      : undefined;
    const searchMapping = this.mappingPromise
      ? await this.mappingPromise.search
      : undefined;
    const model = await this.ensureModel("update", tx);

    let include: Record<string, any> = {};

    //Permite armar el "include" dinámicamente
    if (searchMapping) {
      include = this.includeQuery(searchMapping);
    }

    const updateData = prismaUpdateEntityBuilder(data, mapping);
    let updatedEntity;
    try {
      if (!updateData || Object.keys(updateData).length === 0) {
        updatedEntity = await this.getById(id);
      } else {
        updatedEntity = await model.update({
          where: { id: Number(id) },
          data: updateData,
          include,
        });
      }
    } catch (error) {
      throw new DatabaseError();
    }
    //Post processing mapping
    if (postMapping && updatedEntity) {
      updatedEntity = postMapping(updatedEntity);
    }
    return updatedEntity;
  }
  async search(
    data: any[],
    paginate: boolean,
    currentPage: number,
    amountPerPage: number,
    detalle: boolean,
    tx?: PrismaClient,
  ): Promise<{
    entityList?: T[];
    currentPage: number;
    amountPerPage: number;
    totalElements: number;
  }> {
    //Recibe las reglas de mapeo para construir el query
    const mapping = this.mappingPromise
      ? await this.mappingPromise.search
      : undefined;
    const postMapping = this.mappingPromise
      ? await this.mappingPromise.post
      : undefined;
    const where = prismaQueryBuilder(data, mapping);

    let totalElements, entityList;

    // const model = await this.ensureModel("search");
    let query: { where: any; include?: any; take?: number; skip?: number } = {
      where: { ...where },
    };
    let include: Record<string, any> = {};
    let pagination = {};

    //Permite armar el select dinámicamente según si se solicita el detalle
    if (detalle && mapping) {
      include = this.includeQuery(mapping);
      let amount = Object.keys(include).length;
      if (amount > 0) {
        query = { ...query, include: { ...include } };
      }
    }

    if (paginate) {
      pagination = {
        take: Number(amountPerPage),
        skip: (Number(currentPage) - 1) * Number(amountPerPage),
      };
      query = { ...query, ...pagination };
    }

    // console.log(query);
    //Busca los elementos con paginación
    [totalElements, entityList] = await Promise.all([
      this.model.count({ where }),
      this.model.findMany(query),
    ]).catch(() => {
      throw new DatabaseError();
    });
    console.log(entityList);
    //Post processing mapping
    if (postMapping && entityList && entityList.length > 0) {
      entityList = entityList.map((entity: any) => {
        const newEntity: any = postMapping(entity);
        return newEntity;
      });
    }

    return { entityList, currentPage, amountPerPage, totalElements };
  }
  async getById(id: number, tx?: PrismaClient): Promise<T> {
    const mapping = this.mappingPromise
      ? await this.mappingPromise.search
      : undefined;
    const postMapping = this.mappingPromise
      ? await this.mappingPromise.post
      : undefined;
    const model = await this.ensureModel("search", tx);

    let include: Record<string, any> = {};

    //Permite armar el "include" dinámicamente
    if (mapping) {
      include = this.includeQuery(mapping);
    }
    let entity;
    try {
      entity = await model.findFirst({
        where: { id: Number(id) },
        include,
      });
    } catch (error) {
      throw new DatabaseError();
    }
    //Post processing mapping
    if (postMapping && entity) {
      entity = postMapping(entity);
    }
    return entity;
  }

  async deactivate(id: number, tx?: PrismaClient): Promise<T> {
    const mapping = this.mappingPromise
      ? await this.mappingPromise.create
      : undefined;
    const postMapping = this.mappingPromise
      ? await this.mappingPromise.post
      : undefined;
    const model = await this.ensureModel("create", tx);
    try {
      return await model.update({
        where: { id: Number(id) },
        data: { active: false } as any,
      });
    } catch (error) {
      throw new DatabaseError();
    }
  }
  async activate(id: number, tx?: PrismaClient): Promise<T> {
    const mapping = this.mappingPromise
      ? await this.mappingPromise.create
      : undefined;
    const postMapping = this.mappingPromise
      ? await this.mappingPromise.post
      : undefined;
    const model = await this.ensureModel("create", tx);
    try {
      return await model.update({
        where: { id: Number(id) },
        data: { active: true } as any,
      });
    } catch (error) {
      throw new DatabaseError();
    }
  }

  includeQuery(mapping: any): Record<string, any> {
    let select: Record<string, any> = {};
    let amount = 0;

    Object.keys(mapping).forEach((key: string) => {
      const field = mapping[key]?.field;
      const fieldType = mapping[key]?.type;
      if (field && ["relationArray", "object"].includes(fieldType)) {
        const expandFields = mapping[key]?.expand;
        if (expandFields) {
          // ensure select[field] is an object before assigning child fields
          if (typeof select[field] !== "object") {
            select[field] = {};
          }
          amount++;
          // support both array and single string for expand
          if (Array.isArray(expandFields)) {
            select[field] = { include: {} };
            expandFields.forEach((childField: string) => {
              if (childField) {
                (select[field].include as Record<string, boolean>)[childField] =
                  true;
              }
            });
          } else if (typeof expandFields === "string") {
            select[field] = { include: { [expandFields]: true } };
          } else {
            // fallback: treat as single key
            select[field] = { include: { [String(expandFields)]: true } };
          }
        } else {
          amount++;
          select[field] = true;
        }
      }
    });
    console.log("select", select);
    return select;
  }

  async withTransaction<R>(
    callback: (tx: PrismaClient) => Promise<R>,
  ): Promise<R> {
    return this.prisma.$transaction(callback as any, { timeout: 60000 }) as Promise<R>; // esto debe cambiar cuando se use un mejor server para DB
  }
}
