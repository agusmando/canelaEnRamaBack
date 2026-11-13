import { GenericRepositoryImpl } from "./generic.repository.js";
import { OrderItemDto } from "../dto/order-item/order-item.dto.js";
import { CreateOrderItemDto } from "../dto/order-item/create-order-item.dto.js";
import { UpdateOrderItemDto } from "../dto/order-item/update-order-item.dto.js";

/** Solo lectura: los ítems se crean/modifican a través de la orden. */
export class OrderItemRepository extends GenericRepositoryImpl<
  OrderItemDto,
  CreateOrderItemDto,
  UpdateOrderItemDto
> {
  constructor() {
    super("orderItem", { orderBy: { id: "desc" } });
  }
}
