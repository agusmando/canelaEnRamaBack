import { OrderItemDto } from "../dto/order-item/order-item.dto.ts";
import { CreateOrderItemDto } from "../dto/order-item/create-order-item.dto.ts";
import { UpdateOrderItemDto } from "../dto/order-item/update-order-item.dto.ts";
import { GenericControllerImpl } from "./generic-impl.controller.ts";


export class OrderItemController extends GenericControllerImpl<
  OrderItemDto,
  CreateOrderItemDto,
  UpdateOrderItemDto
> {
  constructor() {
    super("orderItem");
  }
}
