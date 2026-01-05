import { BaseResponse } from "../utils/responseFormat.ts";

export default interface GenericServiceInterface<T, U, V> {
  getListedElements(
    receivedDto: T[],
    paginate: boolean,
    currentPage: number,
    amountPerPage: number,
    detalle: boolean
  ): Promise<
    | {
        entityList: T[];
        currentPage: number;
        amountPerPage: number;
        totalElements: number;
      }
    | { entityList: T[] }
  >;
  findOne(id: number): Promise<T>;
  create(data: U): Promise<T>;
  update(id: number, data: V): Promise<T>;
  deactivate(id: number): Promise<T>;
  activate(id: number): Promise<T>;
}
