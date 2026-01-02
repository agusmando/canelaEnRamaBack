import { AppError } from "../errors/AppError.ts";

export interface GenericRepositoryInterface<T, U, V> {
  ensureModel(type: "search" | "create" | "update" | "search"): Promise<any>;
  create(data: U): Promise<T>;
  update(data: V): Promise<T>;
  search(
    data: any,
    paginate: boolean,
    currentPage: number,
    amountPerPage: number,
    detalle: boolean
  ): Promise<{
    entityList?: T[];
    currentPage: number;
    amountPerPage: number;
    totalElements: number;
  }>;
  post(data: any): Promise<any>;
}
