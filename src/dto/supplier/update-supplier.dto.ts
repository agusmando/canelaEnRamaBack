import { BrandDto } from "../brand/brand.dto.ts";

export class UpdateSupplierDto {
  name: string;
  contact?: string;
  description?: string;
  active: boolean;
  brands: BrandDto[];

  constructor(
    name: string,
    active: boolean,
    brands: BrandDto[],
    contact?: string,
    description?: string
  ) {
    this.name = name;
    this.contact = contact;
    this.brands = brands;
    this.description = description;
    this.active = active;
  }
}
