import { DependencyDto } from "../dependency/dependency.dto.ts";
import { ProductDto } from "../products/product.dto.ts";
import { MovementDto } from "../movement/movement.dto.ts";
import { OfferDto } from "../offer/offer.dto.ts";

export class ProductVariantDto {
  id: number;
  productId: number;
  name: string;
  price?: number;
  profitMargin?: number;
  currentStock: number;
  active: boolean;
  availableWeb: boolean;
  stockThreshold: number;
  availablePedidosYa: boolean;
  contentMeasure?: { id: number; name: string };
  packagingOptions: number[];
  requestTime: string;
  product?: ProductDto;
  measureTypeId: number;
  isComponentOf?: DependencyDto[];
  hasComponents?: DependencyDto[];
  movements?: MovementDto[] = [];
  offers?: OfferDto[] = [];
  finalPrice?: number;
  constructor(
    id: number,
    name: string,
    active: boolean,
    productId: number,
    currentStock: number,
    packagingOptions: number[],
    requestTime: string,
    measureTypeId: number,
    availableWeb: boolean,
    stockThreshold: number,
    availablePedidosYa: boolean,
    contentMeasure?: { id: number; name: string },
    profitMargin?: number,
    price?: number,
    product?: ProductDto,
    isComponentOf?: DependencyDto[],
    hasComponents?: DependencyDto[],
    movements?: MovementDto[],
    offers?: OfferDto[],
    finalPrice?: number,
  ) {
    this.id = id;
    this.productId = productId;
    this.name = name;
    this.active = active;
    this.price = price;
    this.profitMargin = profitMargin;
    this.currentStock = currentStock;
    this.contentMeasure = contentMeasure;
    this.packagingOptions = packagingOptions;
    this.requestTime = requestTime;
    this.product = product;
    this.measureTypeId = measureTypeId;
    this.isComponentOf = isComponentOf;
    this.hasComponents = hasComponents;
    this.movements = movements;
    this.finalPrice = finalPrice;
    this.offers = offers;
    this.availableWeb = availableWeb;
    this.availablePedidosYa = availablePedidosYa;
    this.stockThreshold = stockThreshold;
  }
}
