import { CreateSupplierDto } from "../dto/supplier/create-supplier.dto.js";
import { SupplierDto } from "../dto/supplier/supplier.dto.js";
import { UpdateSupplierDto } from "../dto/supplier/update-supplier.dto.js";
import { SupplierService } from "../services/supplier.service.js";
import { BaseResponse } from "../utils/responseFormat.js";
import { GenericControllerImpl } from "./generic-impl.controller.js";

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
