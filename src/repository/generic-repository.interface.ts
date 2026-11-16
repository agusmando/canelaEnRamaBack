import { PrismaClient } from "@prisma/client";

export interface GenericRepositoryInterface<T, U, V> {
  create(data: U, tx?: any): Promise<T>;
  update(id: number, data: V, tx?: any): Promise<T>;
  search(
    data: any,
    paginate: boolean,
    currentPage: number,
    amountPerPage: number,
    detalle: boolean,
    tx?: any,
  ): Promise<{
    entityList: T[];
    currentPage: number;
    amountPerPage: number;
    totalElements: number;
  }>;
  getById(id: number, tx?: any): Promise<T>;
  deactivate(id: number, tx?: any): Promise<T>;
  activate(id: number, tx?: any): Promise<T>;
  withTransaction<R>(callback: (tx: PrismaClient) => Promise<R>): Promise<R>;
}
