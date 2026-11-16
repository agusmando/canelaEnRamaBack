export default interface GenericServiceInterface<T, U, V> {
  getListedElements(
    filters: any,
    paginate: boolean,
    currentPage: number,
    amountPerPage: number,
    detalle: boolean,
  ): Promise<{
    entityList: T[];
    currentPage: number;
    amountPerPage: number;
    totalElements: number;
  }>;
  findOne(id: number): Promise<T>;
  create(data: U): Promise<T>;
  update(id: number, data: V): Promise<T>;
  deactivate(id: number): Promise<T>;
  activate(id: number): Promise<T>;
}
