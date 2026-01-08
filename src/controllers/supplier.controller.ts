import { CreateSupplierDto } from "../dto/supplier/create-supplier.dto.ts";
import { SupplierDto } from "../dto/supplier/supplier.dto.ts";
import { UpdateSupplierDto } from "../dto/supplier/update-supplier.dto.ts";
import { SupplierService } from "../services/supplier.service.ts";
import { BaseResponse } from "../utils/responseFormat.ts";
import { GenericControllerImpl } from "./generic-impl.controller.ts";

export class SupplierController extends GenericControllerImpl<
  SupplierDto,
  CreateSupplierDto,
  UpdateSupplierDto
> {
  supplierService: SupplierService;
  constructor() {
    super("supplier");
    this.supplierService = new SupplierService();
  }

  async addSupplierBrands(req: any, res: any, next: any) {
    try {
      const suplierId: number = req.params.id;
      const response = await this.supplierService.addRemoveBrands(
        Number(suplierId),
        req.body,
        true
      );
      res
        .status(200)
        .json(new BaseResponse(200, "Supplier brands added", response));
    } catch (error) {
      next(error);
    }
  }

  async removeSupplierBrands(req: any, res: any, next: any) {
    try {
      const suplierId: number = req.params.id;
      const response = await this.supplierService.addRemoveBrands(
        Number(suplierId),
        req.body,
        false
      );
      res
        .status(200)
        .json(new BaseResponse(200, "Supplier brands removed", response));
    } catch (error) {
      next(error);
    }
  }
}
