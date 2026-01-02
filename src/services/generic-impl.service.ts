// import { PrismaClient } from "@prisma/client";
import Prisma from "@prisma/client";
import { prismaQueryBuilder } from "../utils/prismaQueryBuilder.ts";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.ts";
import { prismaUpdateEntityBuilder } from "../utils/prismaUpdateEntityBuilder.ts";
import { BaseResponse, PaginatedResponse } from "../utils/responseFormat.ts";
import type GenericServiceInterface from "./generic-service.interface.ts";
import { AppError } from "../errors/AppError.ts";
import { ErrorsEnum } from "../errors/ErrorsEnum.ts";
import mappingSelector from "../utils/mappingSelector.ts";
import { GenericRepositoryImpl } from "../repository/generic.repository.ts";

const { PrismaClient } = Prisma;

export class GenericServiceImpl<T, U, V>
  implements GenericServiceInterface<T, U, V>
{
  protected prisma;
  private mappingPromise:
    | {
        search: Promise<any>;
        create: Promise<any>;
        update: Promise<any>;
        post: Promise<any>;
      }
    | undefined;
  private prismaName: string;
  protected controllerName: string;
  private model: any | undefined;
  private genericRepositoryImpl: GenericRepositoryImpl<T, U, V>;
  constructor(
    controllerName: string,
    genericRepositoryImpl: GenericRepositoryImpl<T, U, V>
  ) {
    this.genericRepositoryImpl = genericRepositoryImpl;
    this.controllerName = controllerName;
    this.prismaName = controllerName;
    this.mappingPromise = mappingSelector(controllerName) as any;
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }

  async getListedElements(
    receivedDto: T[],
    paginate: boolean = false,
    currentPage: number = 1,
    amountPerPage: number = 10,
    detalle: boolean = false
  ): Promise<BaseResponse<T[]> | PaginatedResponse<T[]>> {
    let entityList = [], totalElements = 0;
    try {
       const response =
        await this.genericRepositoryImpl.search(
          receivedDto,
          paginate,
          currentPage,
          amountPerPage,
          detalle
        );
        entityList = response.entityList ?? [];
        totalElements = response.totalElements;
    } catch (error) {
      console.error("Error fetching entities:", error);
      throw new AppError(ErrorsEnum.SERVER_ERROR);
    }
    if (totalElements === 0 || entityList.length === 0) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
    if (paginate) {
      return new PaginatedResponse<T[]>(
        200,
        "Entidades obtenidas con éxito",
        entityList,
        currentPage,
        amountPerPage,
        totalElements
      );
    } else {
      return new BaseResponse<T[]>(
        200,
        "Entidades obtenidas con éxito",
        entityList
      );
    }
  }
  async findOne(id: number): Promise<BaseResponse<T>> {
    let entity;

    try {
      const mapping = this.mappingPromise
        ? await this.mappingPromise.search
        : undefined;
      const postMapping = this.mappingPromise
        ? await this.mappingPromise.post
        : undefined;
      const model = await this.ensureModel("search");
      let select: Record<string, any> = {};
      let amount = 0;
      //Permite armar el select dinámicamente según si se solicita el detalle
      if (mapping) {
        Object.keys(mapping).forEach((key: string) => {
          const field = mapping[key]?.field;
          if (field) {
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
                    (select[field].include as Record<string, boolean>)[
                      childField
                    ] = true;
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
      }
      entity = await model.findFirst({
        where: { id: Number(id) },
        select,
      });
      //Post processing mapping
      if (postMapping && entity) {
        entity = postMapping(entity);
      }
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
      const postMapping = this.mappingPromise
        ? await this.mappingPromise.post
        : undefined;
      const model = await this.ensureModel("create");

      const createData = prismaCreateEntityBuilder(data as any, mapping);
      let newEntity = await model.create({
        data: createData,
      });

      //Post processing mapping
      if (postMapping && newEntity) {
        newEntity = postMapping(newEntity);
      }

      return new BaseResponse(201, "Entidad creada con éxito", newEntity);
    } catch (error) {
      console.error("Error creating entity:", error);
      throw new AppError(ErrorsEnum.SERVER_ERROR);
    }
  }
  async update(id: number, data: V): Promise<BaseResponse<T>> {
    try {
      const mapping = this.mappingPromise
        ? await this.mappingPromise.update
        : undefined;
      const postMapping = this.mappingPromise
        ? await this.mappingPromise.post
        : undefined;
      const model = await this.ensureModel("update");

      const updateData = prismaUpdateEntityBuilder(data, mapping);
      let updatedEntity = await model.update({
        where: { id: Number(id) },
        data: updateData,
      });
      //Post processing mapping
      if (postMapping && updatedEntity) {
        updatedEntity = postMapping(updatedEntity);
      }

      return new BaseResponse(
        200,
        "Entidad editada correctamente",
        updatedEntity
      );
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  }
  async deactivate(id: number): Promise<BaseResponse<T>> {
    try {
      // const mapping = this.mappingPromise
      //   ? await this.mappingPromise.create
      //   : undefined;
      // const postMapping = this.mappingPromise
      //   ? await this.mappingPromise.post
      //   : undefined;
      const model = await this.ensureModel("create");
      await model.update({
        where: { id: Number(id) },
        data: { active: false } as any,
      });
      return new BaseResponse(200, "Entidad dada de baja correctamente", {});
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  }
  async activate(id: number): Promise<BaseResponse<T>> {
    try {
      // const mapping = this.mappingPromise
      //   ? await this.mappingPromise.create
      //   : undefined;
      // const postMapping = this.mappingPromise
      //   ? await this.mappingPromise.post
      //   : undefined;
      const model = await this.ensureModel("create");
      await model.update({
        where: { id: Number(id) },
        data: { active: true } as any,
      });
      return new BaseResponse(200, "Entidad activada correctamente", {});
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  }
}
