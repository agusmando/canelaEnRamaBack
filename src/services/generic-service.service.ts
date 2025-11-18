import { PrismaClient } from "@prisma/client";
import { prismaQueryBuilder } from "../utils/prismaQueryBuilder.ts";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.ts";
import { BaseResponse } from "../utils/responseFormat.ts";
import type GenericServiceInterface from "./generic-service.interface.ts";
import { AppError } from "../errors/AppError.ts";
import { ErrorsEnum } from "../errors/ErrorsEnum.ts";
import mappingSelector from "../utils/mappingSelector.ts";

export class GenericServiceImpl<T, U, V> implements GenericServiceInterface<T, U, V> {
  protected prisma: PrismaClient;
  private mappingPromise:
    | { search: Promise<any>; create: Promise<any> }
    | undefined;
  private prismaName: string;
  protected controllerName: string;
  private model: any | undefined;
  constructor(controllerName: string) {
    this.controllerName = controllerName;
    this.prismaName = controllerName.toLowerCase();
    this.mappingPromise = mappingSelector(controllerName);
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }

  private async ensureModel(type: "search" | "create" = "search") {
    if (this.model) return this.model;
    const mapping = this.mappingPromise
      ? await this.mappingPromise[type]
      : undefined;
    const modelName = mapping?.modelName || this.prismaName;
    const m = (this.prisma as any)[modelName];
    if (!m) throw new AppError(ErrorsEnum.SERVER_ERROR);
    this.model = m;
    return this.model;
  }

  async getPaginatedElements(
    receivedDto: T[],
    currentPage: number = 1,
    amountPerPage: number = 10,
    detalle: boolean = false
  ): Promise<BaseResponse<T[]>> {
    //Recibe las reglas de mapeo para construir el query
    const mapping = this.mappingPromise
      ? await this.mappingPromise.search
      : undefined;
    const where = prismaQueryBuilder(receivedDto, mapping);

    let totalElements, entityList;
    try {
      const model = await this.ensureModel("search");
      let select: Record<string, boolean> = {};

      //Permite armar el select dinámicamente según si se solicita el detalle
      if (detalle && mapping) {
        Object.keys(mapping).forEach((key: string) => {
          const field = mapping[key]?.field;
          if (field) {
            select[field] = true;
          }
        });
      }

      //Busca los elementos con paginación
      [totalElements, entityList] = await Promise.all([
        model.count({ where }),
        model.findMany({
          where,
          take: Number(amountPerPage),
          skip: (Number(currentPage) - 1) * Number(amountPerPage),
          select,
        }),
      ]);
    } catch (error) {
      console.error("Error fetching entities:", error);
      throw new AppError(ErrorsEnum.SERVER_ERROR);
    }
    if (totalElements === 0 || entityList.length === 0) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
    return new BaseResponse(
      200,
      "Entidades obtenidas con éxito",
      entityList as T[]
    );
  }
  async findOne(id: number): Promise<BaseResponse<T>> {
    let entity;

    try {
      const mapping = this.mappingPromise
        ? await this.mappingPromise.search
        : undefined;
      const model = await this.ensureModel("search");
      let select: Record<string, boolean> = {};
      //Permite armar el select dinámicamente según si se solicita el detalle
      if (mapping) {
        Object.keys(mapping).forEach((key: string) => {
          const field = mapping[key]?.field;
          if (field) {
            select[field] = true;
          }
        });
      }
      entity = await model.findFirst({
        where: { id: Number(id) },
        select,
      });
    } catch (error) {
      console.error("Error fetching entity:", error);
      throw new AppError(ErrorsEnum.SERVER_ERROR);
    }
    if (!entity) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
    return new BaseResponse(200, "Entidad obtenida con éxito", entity);
  }
  async create(data: U): Promise<BaseResponse<T>> {
    try {
      const mapping = this.mappingPromise
        ? await this.mappingPromise.create
        : undefined;
      const model = await this.ensureModel("create");

      const createData = prismaCreateEntityBuilder(data as any, mapping);
      const newEntity = await model.create({
        data: createData,
      });

      return new BaseResponse(201, "Entidad creada con éxito", newEntity);
    } catch (error) {
      console.error("Error creating entity:", error);
      throw new AppError(ErrorsEnum.SERVER_ERROR);
    }
  }
  async update(id: number, data: V): Promise<BaseResponse<T>> {
    try {
        const mapping = this.mappingPromise
            ? await this.mappingPromise.create
            : undefined;
        const model = await this.ensureModel("create");

        const updatedProduct = await model.update({
            where: { id: Number(id) },
            data,
        });
        return new BaseResponse(
            200,
            "Entidad editada correctamente",
            updatedProduct
        );
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  }
  async deactivate(id: number): Promise<BaseResponse<T>> {
    try {
        const mapping = this.mappingPromise
            ? await this.mappingPromise.create
            : undefined;
        const model = await this.ensureModel("create");
      await model.update({
        where: { id: Number(id) },
        data: ({ active: false } as any),
      });
      return new BaseResponse(200, "Entidad dada de baja correctamente", {});
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  }
  async activate(id: number): Promise<BaseResponse<T>> {
    try {
        const mapping = this.mappingPromise
            ? await this.mappingPromise.create
            : undefined;
        const model = await this.ensureModel("create");
        await model.update({
            where: { id: Number(id) },
            data: ({ active: true } as any),
        });
      return new BaseResponse(200, "Entidad activada correctamente", {});
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  }
}