
import { CreateSupplierDto } from "../dto/supplier/create-supplier.dto.ts";
import { SupplierDto } from "../dto/supplier/supplier.dto.ts";
import { UpdateSupplierDto } from "../dto/supplier/update-supplier.dto.ts";
import { GenericControllerImpl } from "./generic-impl.controller.ts";

// const tagService = new TagService();

export class SupplierController extends GenericControllerImpl<SupplierDto, CreateSupplierDto, UpdateSupplierDto> {
  constructor() {
    super("supplier")
  }
}