export class UpdateProductVariantDto {
  name?: string;
  price?: number;
  profitMargin?: number;
  active?: boolean;
  measureTypeId?: number;
  contentAmount?: number;
  requestTime?: string;
  addComponents?: { productVariantId: number; quantity: number }[];
  removeComponents?: { productVariantId: number }[];
  editComponents?: { productVariantId: number; quantity: number }[];
  stockIncrement?: number;
  availableWeb?: boolean;
  availablePedidosYa?: boolean;
  currentStock?: number;
  removeImages?: { id: number }[];
  images?: any[];

  constructor(
    availableWeb?: boolean,
    availablePedidosYa?: boolean,
    name?: string,
    active?: boolean,
    measureTypeId?: number,
    contentAmount?: number,
    price?: number,
    profitMargin?: number,
    currentStock?: number,
    stockIncrement?: number,
    requestTime?: string,
    addComponents?: { productVariantId: number; quantity: number }[],
    removeComponents?: { productVariantId: number }[],
    editComponents?: { productVariantId: number; quantity: number }[],
    removeImages?: { id: number }[],
    images?: any[],
  ) {
    this.name = name;
    this.active = active;
    this.measureTypeId = measureTypeId;
    this.contentAmount = contentAmount;
    this.currentStock = currentStock;
    this.price = price;
    this.profitMargin = profitMargin;
    this.stockIncrement = stockIncrement;
    this.addComponents = addComponents;
    this.requestTime = requestTime;
    this.removeComponents = removeComponents;
    this.editComponents = editComponents;
    this.removeImages = removeImages;
    this.images = images;
    this.availableWeb = availableWeb;
    this.availablePedidosYa = availablePedidosYa;
  }
}
