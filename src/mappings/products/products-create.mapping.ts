import { ProductDto } from "../../dto/products/product.dto.ts";

export const productCreateMapping = {
  Category: { relation: true, connectField: "categoryId", allowCreate: false },
  Tags: { relation: true, connectField: "id", allowCreate: false },
  movements: { relation: true, connectField: "id", allowCreate: true },
  // supplierId: { relation: true, connectField: 'id', allowCreate: false },
};
