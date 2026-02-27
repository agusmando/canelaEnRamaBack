export class CreateProductVariantDto {
  name: string;
  productId: number;
  price: number;
  profitMargin: number;
  currentStock: number;
  active: boolean;
  availableWeb: boolean;
  availablePedidosYa: boolean;
  contentMeasure: string;
  packagingOptions?: number[];
  requestTime?: string;
  hasComponents?: { productId: number; quantity: number }[];
  stockThreshold: number;
  constructor(
    name: string,
    productId: number,
    price: number,
    profitMargin: number,
    currentStock: number,
    active: boolean,
    contentMeasure: string,
    availableWeb: boolean,
    availablePedidosYa: boolean,
    stockThreshold: number,
    packagingOptions?: number[],
    requestTime?: string,
    hasComponents?: { productId: number; quantity: number }[]
  ) {
    this.name = name;
    this.productId = productId;
    this.price = price;
    this.profitMargin = profitMargin;
    this.currentStock = currentStock;
    this.active = active;
    this.contentMeasure = contentMeasure;
    this.packagingOptions = packagingOptions;
    this.requestTime = requestTime;
    this.hasComponents = hasComponents;
    this.stockThreshold = stockThreshold;
    this.availableWeb = availableWeb;
    this.availablePedidosYa = availablePedidosYa;
  }
}
