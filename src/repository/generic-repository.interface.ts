import { PrismaClient } from "@prisma/client/extension";

export interface GenericRepositoryInterface<T, U, V> {
  ensureModel(type: "search" | "create" | "update" | "search"): Promise<any>;
  create(data: U): Promise<T>;
  update(id: number, data: V): Promise<T>;
  search(
    data: any,
    paginate: boolean,
    currentPage: number,
    amountPerPage: number,
    detalle: boolean
  ): Promise<
    | {
        entityList?: T[];
        currentPage: number;
        amountPerPage: number;
        totalElements: number;
      }
    | { entityList: T[] }
  >;
  getById(id: number): Promise<T>;
  deactivate(id: number): Promise<T>;
  activate(id: number): Promise<T>;
  withTransaction<T>(callback: (tx: PrismaClient) => Promise<T>): Promise<T>;
}
