export class CreateProductVariantDto {
  name: string;
  productId: number;
  price: number;
  profitMargin: number;
  currentStock: number;
  active: boolean;
  availableWeb: boolean;
  availablePedidosYa: boolean;
  measureTypeId: number;
  contentAmount?: number;
  requestTime?: string;
  hasComponents?: { productId: number; quantity: number }[];
  constructor(
    name: string,
    productId: number,
    price: number,
    profitMargin: number,
    currentStock: number,
    active: boolean,
    measureTypeId: number,
    availableWeb: boolean,
    availablePedidosYa: boolean,
    contentAmount?: number,
    requestTime?: string,
    hasComponents?: { productId: number; quantity: number }[]
  ) {
    this.name = name;
    this.productId = productId;
    this.price = price;
    this.profitMargin = profitMargin;
    this.currentStock = currentStock;
    this.active = active;
    this.measureTypeId = measureTypeId;
    this.contentAmount = contentAmount;
    this.requestTime = requestTime;
    this.hasComponents = hasComponents;
    this.availableWeb = availableWeb;
    this.availablePedidosYa = availablePedidosYa;
  }
}
