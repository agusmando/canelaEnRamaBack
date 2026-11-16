import { OrderDto } from "../dto/order/order.dto.js";
import { CreateOrderDto } from "../dto/order/create-order.dto.js";
import { UpdateOrderDto } from "../dto/order/update-order.dto.js";
import { OrderService } from "../services/order.service.js";
import { BaseResponse, PaginatedResponse } from "../utils/responseFormat.js";
import { GenericControllerImpl, parseId } from "./generic-impl.controller.js";
import { getActor } from "../middleware/auth.middleware.js";

export class OrderController extends GenericControllerImpl<
  OrderDto,
  CreateOrderDto,
  UpdateOrderDto
> {
  readonly orderService: OrderService;

  constructor(orderService = new OrderService()) {
    super(orderService);
    this.orderService = orderService;
  }

  async create(req: any, res: any, next: any) {
    try {
      const response = await this.orderService.createOrder(req.body, getActor(req).userId!);
      res.status(201).json(new BaseResponse(201, "Order created", response));
    } catch (error) {
      next(error);
    }
  }

  /** GET /order/mine — órdenes del usuario logueado (paginado). */
  async findMine(req: any, res: any, next: any) {
    try {
      const page = Math.max(1, Number(req.query.currentPage) || 1);
      const perPage = Math.max(1, Number(req.query.amountPerPage) || 10);
      const result = await this.orderService.listMyOrders(getActor(req).userId!, page, perPage);
      res
        .status(200)
        .json(
          new PaginatedResponse(
            200,
            "Orders found",
            result.entityList,
            result.currentPage,
            result.amountPerPage,
            result.totalElements,
          ),
        );
    } catch (error) {
      next(error);
    }
  }

  async findOne(req: any, res: any, next: any) {
    try {
      const response = await this.orderService.getOrder(parseId(req.params.id), getActor(req));
      res.status(200).json(new BaseResponse(200, "Order found", response));
    } catch (error) {
      next(error);
    }
  }

  async update(req: any, res: any, next: any) {
    try {
      const response = await this.orderService.updateOrder(
        parseId(req.params.id),
        req.body,
        getActor(req),
      );
      res.status(200).json(new BaseResponse(200, "Order updated", response));
    } catch (error) {
      next(error);
    }
  }
}
