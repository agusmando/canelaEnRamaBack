import { BrandDto } from "../brand/brand.dto.js";

export class SupplierDto {
  id: number;
  name: string;
  contact?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  brands: (BrandDto | { id: number })[];
  active: boolean;

  constructor(
    id: number,
    name: string,
    createdAt: Date,
    updatedAt: Date,
    brands: (BrandDto | { id: number })[],
    active: boolean,
    contact?: string,
    description?: string
  ) {
    this.id = id;
    this.name = name;
    this.contact = contact;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.brands = brands;
    this.active = active;
    this.description = description;
  }
}
