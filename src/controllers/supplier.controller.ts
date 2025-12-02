import { CreateSupplierDto } from "../dto/supplier/create-supplier.dto.ts";
import { SupplierDto } from "../dto/supplier/supplier.dto.ts";
import { UpdateSupplierDto } from "../dto/supplier/update-supplier.dto.ts";
import { SupplierService } from "../services/supplier.service.ts";
import { GenericControllerImpl } from "./generic-impl.controller.ts";

const supplierService = new SupplierService();

export class SupplierController extends GenericControllerImpl<
  SupplierDto,
  CreateSupplierDto,
  UpdateSupplierDto
> {
  constructor() {
    super("supplier");
  }

  async addSupplierBrands(req: any, res: any, next: any) {
    try {
      const supplierId: number = req.params.id;
      const response = await supplierService.addSupplierBrands(
        supplierId,
        req.body
      );
      res.status(response.statusCode).json({ ...response });
    } catch (error) {
      next(error);
    }
  }

  async removeSupplierBrandsTags(req: any, res: any, next: any) {
    try {
      const supplierId: number = req.params.id;
      const response = await supplierService.removeSupplierBrand(
        supplierId,
        req.body
      );
      res.status(response.statusCode).json({ ...response });
    } catch (error) {
      next(error);
    }
  }
}
