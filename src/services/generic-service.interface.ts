import { BaseResponse } from "../utils/responseFormat.ts";


export default interface GenericServiceInterface<T, U, V> {
    getPaginatedElements(
        receivedDto: T[],
        currentPage: number,
        amountPerPage: number,
        detalle: boolean): Promise<BaseResponse<T[]>>;
    findOne(id: number): Promise<BaseResponse<T>>;
    create(data: U): Promise<BaseResponse<T>>;
    update(id: number, data: V): Promise<BaseResponse<T>>;
    deactivate(id: number): Promise<BaseResponse<T>>;
    activate(id: number): Promise<BaseResponse<T>>;
}