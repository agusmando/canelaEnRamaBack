import { OrderDto } from "../dto/order/order.dto.js";
import { CreateOrderDto } from "../dto/order/create-order.dto.js";
import { UpdateOrderDto } from "../dto/order/update-order.dto.js";
import { OrderService } from "../services/order.service.js";
import { BaseResponse } from "../utils/responseFormat.js";
import { GenericControllerImpl } from "./generic-impl.controller.js";

export class OrderController extends GenericControllerImpl<
  OrderDto,
  CreateOrderDto,
  UpdateOrderDto
> {
  orderService: OrderService;
  constructor() {
    super("order");
    this.orderService = new OrderService();
  }

  async create(req: any, res: any, next: any) {
    try {
      const data = req.body;
      const sessionId = req.session?.userId;
      console.log(sessionId)
      const response = await this.orderService.createOrder(data, sessionId);
      res.status(201).json(new BaseResponse(200, "Order created", response));
    } catch (error) {
      next(error);
    }
  }
   
  async findOne(req: any, res: any, next: any) {
    try {
      const response = await this.orderService.getOrder(Number(req.params.id));
      res.status(200).json(new BaseResponse(200, "Order found", response));
    } catch (error) {
      next(error);
    }
  }

  async update(req: any, res: any, next: any) {
    try {
      const data = req.body;
      const response = await this.orderService.updateOrder(Number(req.params.id), data);
      res.status(201).json(new BaseResponse(201, "Order updated", response));
    } catch (error) {
      next(error);
    }
  } 
}
