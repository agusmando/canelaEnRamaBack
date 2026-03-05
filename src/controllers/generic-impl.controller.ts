import { GenericServiceImpl } from "../services/generic-impl.service.js";
import { BaseResponse, PaginatedResponse } from "../utils/responseFormat.js";
import type GenericControllerInterface from "./generic-controller.interface.js";

export class GenericControllerImpl<T, U, V>
  implements GenericControllerInterface
{
  service: GenericServiceImpl<T, U, V>;
  protected controllerName: string;

  constructor(controllerName: string) {
    this.controllerName = controllerName;
    this.service = new GenericServiceImpl(controllerName);
  }
  async findAll(req: any, res: any, next: any) {
    const {
      currentPage = 1,
      amountPerPage = 10,
      paginate = false,
      detalle = false,
    } = req.query;
    try {
      const response = await this.service.getListedElements(
        req.query as any,
        paginate as boolean,
        Number(currentPage),
        Number(amountPerPage),
        detalle as boolean
      );
      const entityList = response.entityList ?? [];
      const totalElements =
        "totalElements" in response &&
        typeof response.totalElements === "number"
          ? response.totalElements
          : 0;
      if (paginate && response) {
        res
          .status(200)
          .json(
            new PaginatedResponse<T>(
              200,
              "Entidades obtenidas con éxito",
              entityList,
              response.currentPage,
              response.amountPerPage,
              totalElements
            )
          );
      } else {
        res
          .status(200)
          .json(
            new BaseResponse<T>(
              200,
              "Entidades obtenidas con éxito",
              entityList ?? response
            )
          );
      }
    } catch (error) {
      next(error);
    }
  }
  async findOne(req: any, res: any, next: any) {
    try {
      const objectId = req.params.id;
      const entity = await this.service.findOne(Number(objectId));
      res
        .status(200)
        .json(
          new BaseResponse(200, "Entidad obtenida con éxito", entity ?? {})
        );
    } catch (error) {
      next(error);
    }
  }
  async create(req: any, res: any, next: any) {
    try {
      const data = req.body;
      const createdEntity = await this.service.create(data);
      res
        .status(201)
        .json(new BaseResponse(201, "Entidad creada con éxito", createdEntity));
    } catch (error) {
      next(error);
    }
  }
  async update(req: any, res: any, next: any) {
    try {
      const objectId = req.params.id;
      const updatedEntity = await this.service.update(Number(objectId), req.body);
      res.status(200).json(new BaseResponse(200, "Entidad actualizada", updatedEntity));
    } catch (error) {
      next(error);
    }
  }
  async deactivate(req: any, res: any, next: any) {
    try {
      const objectId = req.params.id;
      await this.service.deactivate(Number(objectId));
      res.status(204).json(new BaseResponse(204, "Entidad desactivada", {}));
    } catch (error) {
      next(error);
    }
  }

  async activate(req: any, res: any, next: any) {
    try {
      const objectId = req.params.id;
      await this.service.activate(Number(objectId));
      res.status(204).json(new BaseResponse(204, "Entidad activada", {}));
    } catch (error) {
      next(error);
    }
  }
}
