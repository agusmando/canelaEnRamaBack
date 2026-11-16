import { OrderItemDto } from "../dto/order-item/order-item.dto.js";
import { CreateOrderItemDto } from "../dto/order-item/create-order-item.dto.js";
import { UpdateOrderItemDto } from "../dto/order-item/update-order-item.dto.js";
import { OrderItemRepository } from "../repository/order-item.repository.js";
import { GenericServiceImpl } from "../services/generic-impl.service.js";
import { GenericControllerImpl } from "./generic-impl.controller.js";

export class OrderItemController extends GenericControllerImpl<
  OrderItemDto,
  CreateOrderItemDto,
  UpdateOrderItemDto
> {
  constructor() {
    super(new GenericServiceImpl(new OrderItemRepository()));
  }
}
