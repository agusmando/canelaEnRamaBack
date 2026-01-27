import { GenericServiceImpl } from "./generic-impl.service.ts";
import { OrderDto } from "../dto/order/order.dto.ts";
import { CreateOrderDto } from "../dto/order/create-order.dto.ts";
import { UpdateOrderDto } from "../dto/order/update-order.dto.ts";
import { ValidationError } from "../errors/application/ValidationError.ts";
import { OrderRepository } from "../repository/order.repository.ts";
import { ProductVariantService } from "./product-variant.service.ts";
import { CreateOrderItemDto } from "../dto/order-item/create-order-item.dto.ts";

export class OrderService extends GenericServiceImpl<
  OrderDto,
  CreateOrderDto,
  UpdateOrderDto
> {
  protected orderRepository: OrderRepository;
  private productVariantService: ProductVariantService;
  constructor() {
    super("order");
    this.orderRepository = new OrderRepository();
    this.productVariantService = new ProductVariantService();
  }

  async createOrder(data: CreateOrderDto): Promise<any> {
    console.log("data", data);
    if (data.orderItems.length == 0) {
      throw new ValidationError();
    }
    const itemsForCreation: Promise<CreateOrderItemDto>[] = data.orderItems.map(
      async (item) => {
        const productVariant = await this.productVariantService.findOne(
          item.productVariantId,
        );
        if (!productVariant) {
          throw new ValidationError();
        }
        return {
          quantity: item.quantity,
          productVariantId: item.productVariantId,
          productNameSnapshot: productVariant.product?.name || "",
          variantNameSnapshot: productVariant.name,
          unitPriceSnapshot: productVariant.finalPrice || 0,
          status: "PENDING",
        };
      },
    );

    const orderItems = await Promise.all(itemsForCreation);
    return await this.orderRepository.create({
      ...data,
      orderItems,
    });
  }

  async getOrder(sessionId: string) {
    return await this.orderRepository.getOrder(sessionId);
  }

  async updateOrder(sessionId: string, data: UpdateOrderDto) {
    if (!sessionId) {
      throw new ValidationError();
    }
    console.log("data", data);
    if (data.userSuperTokensId) {
      return await this.orderRepository.mergeSessionOrderToUserOrder(
        sessionId,
        data.userSuperTokensId,
      );
    }
    if (data.addItem && data.addItem.length > 0) {
      await this.orderRepository.addItemsToOrder(sessionId, data.addItem);
    }
    if (data.removeItem && data.removeItem.length > 0) {
      const response = await this.orderRepository.removeItemsFromOrder(
        sessionId,
        data.removeItem,
      );
      if (response.items && response.items.length == 0) {
        this.orderRepository.deleteOrder(sessionId);
      }
      return response;
    }
    if (data.editItem && data.editItem.length > 0) {
      const response = await this.orderRepository.editItemOfOrder(
        sessionId,
        data.editItem,
      );
      if (response.items && response.items.length == 0) {
        this.orderRepository.deleteOrder(sessionId);
      }
      return response;
    }
    return await this.orderRepository.updateTimeOnOrder(sessionId);
  }
  //   async addRemoveProducts(
  //     orderId: number,
  //     productData: UpdateOrderProductDto,
  //     addingProduct: boolean
  //   ): Promise<OrderDto> {
  //     if (!orderId || orderId == 0) {
  //       throw new NotFoundError();
  //     }
  //     if (!productData.productsId || productData.productsId.length == 0) {
  //       throw new ValidationError();
  //     }
  //     return await this.orderRepository.addRemoveProducts(
  //       Number(orderId),
  //       productData,
  //       addingProduct
  //     );
  //   }
}
