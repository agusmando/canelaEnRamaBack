import { OrderItemDto } from "../dto/order-item/order-item.dto.ts";
import { CreateOrderItemDto } from "../dto/order-item/create-order-item.dto.ts";
import { UpdateOrderItemDto } from "../dto/order-item/update-order-item.dto.ts";
import { OrderItemService } from "../services/order-item.service.ts";
import { BaseResponse } from "../utils/responseFormat.ts";
import { GenericControllerImpl } from "./generic-impl.controller.ts";


export class OrderItemController extends GenericControllerImpl<
  OrderItemDto,
  CreateOrderItemDto,
  UpdateOrderItemDto
> {
  orderItemService: OrderItemService;
  constructor() {
    super("orderItem");
    this.orderItemService = new OrderItemService();
  }

//   async addOrderItemProducts(req: any, res: any, next: any) {
//     try {
//       const orderItemId: number = req.params.id;
//       const response = await this.orderItemService.addRemoveProducts(
//         Number(orderItemId),
//         req.body,
//         true
//       );
//       res
//         .status(200)
//         .json(new BaseResponse(200, "OrderItem products added", response));
//     } catch (error) {
//       next(error);
//     }
//   }

//   async removeOrderItemProducts(req: any, res: any, next: any) {
//     try {
//       const orderItemId: number = req.params.id;
//       const response = await this.orderItemService.addRemoveProducts(
//         Number(orderItemId),
//         req.body,
//         false
//       );
//       res
//         .status(200)
//         .json(new BaseResponse(200, "OrderItem products removed", response));
//     } catch (error) {
//       next(error);
//     }
//   }
}
