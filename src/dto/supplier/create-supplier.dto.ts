export class CreateSupplierDto {
  name: string;
  contact?: string;
  description?: string;
  brands: { id: number }[];

  constructor(
    name: string,
    brands: { id: number }[],
    contact?: string,
    description?: string
  ) {
    this.name = name;
    this.contact = contact;
    this.description = description;
    this.brands = brands;
  }
}
