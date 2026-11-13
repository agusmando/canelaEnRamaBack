import { GenericServiceImpl } from "../services/generic-impl.service.js";
import { BaseResponse, PaginatedResponse } from "../utils/responseFormat.js";
import type GenericControllerInterface from "./generic-controller.interface.js";
import { BadRequestError } from "../errors/application/BadRequestError.js";

/** Los query params llegan como string: "false" es truthy si no se parsea. */
export const parseBool = (value: unknown, fallback = false): boolean => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes"].includes(String(value).toLowerCase());
};

export const parseId = (value: unknown, name = "id"): number => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError(`Parámetro "${name}" inválido`);
  }
  return id;
};

/**
 * Controller CRUD genérico. Recibe el servicio por constructor para que los
 * controllers específicos usen SU servicio también en los endpoints heredados:
 *
 *   class OfferController extends GenericControllerImpl<...> {
 *     constructor(private offerService = new OfferService()) { super(offerService); }
 *   }
 */
export class GenericControllerImpl<T, U, V> implements GenericControllerInterface {
  service: GenericServiceImpl<T, U, V>;

  constructor(serviceOrModel: string | GenericServiceImpl<T, U, V>) {
    this.service =
      typeof serviceOrModel === "string"
        ? new GenericServiceImpl<T, U, V>(serviceOrModel)
        : serviceOrModel;
  }

  async findAll(req: any, res: any, next: any) {
    try {
      const { currentPage = 1, amountPerPage = 10 } = req.query;
      const paginate = parseBool(req.query.paginate);
      const detalle = parseBool(req.query.detalle);
      const response = await this.service.getListedElements(
        req.query,
        paginate,
        Number(currentPage),
        Number(amountPerPage),
        detalle,
      );
      if (paginate) {
        return res
          .status(200)
          .json(
            new PaginatedResponse<T>(
              200,
              "Entidades obtenidas con éxito",
              response.entityList,
              response.currentPage,
              response.amountPerPage,
              response.totalElements,
            ),
          );
      }
      res
        .status(200)
        .json(new BaseResponse<T>(200, "Entidades obtenidas con éxito", response.entityList));
    } catch (error) {
      next(error);
    }
  }

  async findOne(req: any, res: any, next: any) {
    try {
      const entity = await this.service.findOne(parseId(req.params.id));
      res.status(200).json(new BaseResponse(200, "Entidad obtenida con éxito", entity ?? {}));
    } catch (error) {
      next(error);
    }
  }

  async create(req: any, res: any, next: any) {
    try {
      const createdEntity = await this.service.create(req.body);
      res.status(201).json(new BaseResponse(201, "Entidad creada con éxito", createdEntity ?? {}));
    } catch (error) {
      next(error);
    }
  }

  async update(req: any, res: any, next: any) {
    try {
      const updatedEntity = await this.service.update(parseId(req.params.id), req.body);
      res.status(200).json(new BaseResponse(200, "Entidad actualizada", updatedEntity ?? {}));
    } catch (error) {
      next(error);
    }
  }

  async deactivate(req: any, res: any, next: any) {
    try {
      await this.service.deactivate(parseId(req.params.id));
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  async activate(req: any, res: any, next: any) {
    try {
      await this.service.activate(parseId(req.params.id));
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
}
