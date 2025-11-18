import { GenericServiceImpl } from "../services/generic-impl.service.ts";
import type GenericControllerInterface from "./generic-controller.interface.ts";

export class GenericControllerImpl<T, U, V> implements GenericControllerInterface {

  service: GenericServiceImpl<T, U, V>;
  protected controllerName: string;

  constructor(controllerName: string) {
      this.controllerName = controllerName;
      this.service = new GenericServiceImpl(controllerName);
  }
  async findAll(req: any, res: any, next: any) {
    const { currentPage = 1, amountPerPage = 10, paginate = false, detalle = false } = req.query;
    try {
      const response = await this.service.getListedElements(
      req.query as any,
      paginate as boolean,
      Number(currentPage),
      Number(amountPerPage),
        detalle as boolean
      );
      res.status(response.statusCode).json({ ...response });
    } catch (error) {
      next(error);
    }
  }
  async findOne(req: any, res: any, next: any) {
    try {
      const productId = req.params.id;
      const response = await this.service.findOne(Number(productId));
      res.status(response.statusCode).json({ ...response });
    } catch (error) {
      next(error);
    }
  };
  async create(req: any, res: any, next: any) {
    try {
      const productData = req.body;
      const response = await this.service.create(productData);
      res.status(response.statusCode).json({ ...response });
    } catch (error) {
      next(error);
    }
  };
  async update(req: any, res: any, next: any) {
    try {
      const productId = req.params.id;
      const response = await this.service.update(Number(productId), req.body);
      res.status(response.statusCode).json({ ...response });
    } catch (error) {
      next(error);
    }
  };
  async deactivate(req: any, res: any, next: any) {
    try {
      const productId = req.params.id;
      const response = await this.service.deactivate(Number(productId));
      res.status(response.statusCode).json({ ...response });
    } catch (error) {
      next(error);
    }
  };

  async activate(req: any, res: any, next: any) {
    try {
      const productId = req.params.id;
      const response = await this.service.activate(Number(productId));
      res.status(response.statusCode).json({ ...response });
    } catch (error) {
      next(error);
    }
  };
}