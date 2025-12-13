export class UpdateProductVariantDto {
  name?: string;
  price?: number;
  profitMargin?: number;
  active?: boolean;
  measureTypeId?: number;
  contentAmount?: number;
  requestTime?: string;
  addComponents?: { productId: number; quantity: number }[];
  removeComponents?: { productId: number }[];
  editComponents?: { productId: number; quantity: number }[];
  stockIncrement?: number;
  currentStock?: number;

  constructor(
    name?: string,
    active?: boolean,
    measureTypeId?: number,
    contentAmount?: number,
    price?: number,
    profitMargin?: number,
    currentStock?: number,
    stockIncrement?: number,
    requestTime?: string,
    addComponents?: { productId: number; quantity: number }[],
    removeComponents?: { productId: number }[],
    editComponents?: { productId: number; quantity: number }[]
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
  }
}
