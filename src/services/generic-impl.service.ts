import type GenericServiceInterface from "./generic-service.interface.js";
import { GenericRepositoryImpl, type SearchResult } from "../repository/generic.repository.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";

/**
 * Servicio CRUD genérico.
 *
 * Dos formas de usarlo:
 *   - CRUD puro:            new GenericServiceImpl("tag")
 *   - Con repo propio:      class OrderService extends GenericServiceImpl<...> {
 *                             constructor(private repo = new OrderRepository()) { super(repo); }
 *                           }
 * En el segundo caso el CRUD heredado y los métodos propios usan EL MISMO
 * repositorio, y se puede sobreescribir cualquier método sin efectos colaterales.
 */
export class GenericServiceImpl<T, U, V> implements GenericServiceInterface<T, U, V> {
  protected readonly repository: GenericRepositoryImpl<T, U, V>;

  constructor(repositoryOrModel: string | GenericRepositoryImpl<T, U, V>) {
    this.repository =
      typeof repositoryOrModel === "string"
        ? new GenericRepositoryImpl<T, U, V>(repositoryOrModel)
        : repositoryOrModel;
  }

  /** Listado con filtros. Una lista vacía NO es un error: devuelve []. */
  async getListedElements(
    filters: any,
    paginate: boolean = false,
    currentPage: number = 1,
    amountPerPage: number = 10,
    detalle: boolean = false,
  ): Promise<SearchResult<T>> {
    return this.repository.search(filters, paginate, currentPage, amountPerPage, detalle);
  }

  async findOne(id: number): Promise<T> {
    const entity = await this.repository.getById(id);
    if (!entity) throw new NotFoundError();
    return entity;
  }

  async create(data: U): Promise<T> {
    return this.repository.create(data);
  }

  async update(id: number, data: V): Promise<T> {
    return this.repository.update(id, data);
  }

  async deactivate(id: number): Promise<T> {
    return this.repository.deactivate(id);
  }

  async activate(id: number): Promise<T> {
    return this.repository.activate(id);
  }
}
