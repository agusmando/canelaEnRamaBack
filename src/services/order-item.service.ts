
import { GenericServiceImpl } from "./generic-impl.service.ts";
import { NotFoundError } from "../errors/application/NotFoundError.ts";
import { ValidationError } from "../errors/application/ValidationError.ts";
import { OrderItemDto } from "../dto/order-item/order-item.dto.ts";
import { CreateOrderItemDto } from "../dto/order-item/create-order-item.dto.ts";
import { UpdateOrderItemDto } from "../dto/order-item/update-order-item.dto.ts";
import { OrderItemRepository } from "../repository/order-item.repository.ts";

export class OrderItemService extends GenericServiceImpl<
  OrderItemDto,
  CreateOrderItemDto,
  UpdateOrderItemDto
> {
  protected orderItemRepository: OrderItemRepository;
  constructor() {
    super("orderItem");
    this.orderItemRepository = new OrderItemRepository();
  }
}
