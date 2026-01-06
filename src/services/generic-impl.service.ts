// import { PrismaClient } from "@prisma/client";
import Prisma from "@prisma/client";
import { prismaQueryBuilder } from "../utils/prismaQueryBuilder.ts";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.ts";
import { prismaUpdateEntityBuilder } from "../utils/prismaUpdateEntityBuilder.ts";
import { BaseResponse, PaginatedResponse } from "../utils/responseFormat.ts";
import type GenericServiceInterface from "./generic-service.interface.ts";
import { AppError } from "../errors/AppError.ts";
import mappingSelector from "../utils/mappingSelector.ts";
import { GenericRepositoryImpl } from "../repository/generic.repository.ts";
import { NotFoundError } from "../errors/application/NotFoundError.ts";
import { ServerError } from "../errors/application/ServerError.ts";

export class GenericServiceImpl<T, U, V>
  implements GenericServiceInterface<T, U, V>
{
  private mappingPromise:
    | {
        search: Promise<any>;
        create: Promise<any>;
        update: Promise<any>;
        post: Promise<any>;
      }
    | undefined;
  protected controllerName: string;
  private genericRepositoryImpl: GenericRepositoryImpl<T, U, V>;
  constructor(controllerName: string) {
    this.controllerName = controllerName;
    this.genericRepositoryImpl = new GenericRepositoryImpl(
      controllerName
    );
  }

  async getListedElements(
    receivedDto: T[],
    paginate: boolean = false,
    currentPage: number = 1,
    amountPerPage: number = 10,
    detalle: boolean = false
  ): Promise<{
    entityList: T[];
    currentPage: number;
    amountPerPage: number;
    totalElements: number;
  }> {
    const response = await this.genericRepositoryImpl.search(
      receivedDto,
      paginate,
      currentPage,
      amountPerPage,
      detalle
    );
    if (response.entityList === undefined || response.entityList.length === 0) {
      throw new NotFoundError()
    }
    return {
      ...response,
      entityList: response.entityList ?? [],
    };
  }
  async findOne(id: number): Promise<T> {
    const entity = await this.genericRepositoryImpl.getById(id);
    if (!entity) {
      throw new NotFoundError()
    }
    return entity;
  }
  
  async create(data: U): Promise<any> {
    const newEntity = await this.genericRepositoryImpl.create(data);
    if (!newEntity) {
      throw new ServerError()
    } else {
      return;
    }
  }
  async update(id: number, data: V): Promise<any> {
    const newEntity = await this.genericRepositoryImpl.update(id, data);
    if (!newEntity) {
      throw new ServerError()
    } else {
      return;
    }
  }
  async deactivate(id: number): Promise<any> {
    const entity = await this.genericRepositoryImpl.deactivate(id);
    if (!entity) {
      throw new NotFoundError()
    } else {
      return;
    }
  }
  async activate(id: number): Promise<any> {
    const entity = await this.genericRepositoryImpl.activate(id);
    if (!entity) {
      throw new NotFoundError()
    } else {
      return;
    }
  }
}
