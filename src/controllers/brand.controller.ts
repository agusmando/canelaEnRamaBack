import { BrandDto } from "../dto/brand/brand.dto.ts";
import { CreateBrandDto } from "../dto/brand/create-brand.dto.ts";
import { UpdateBrandDto } from "../dto/brand/update-brand.dto.ts";
import { BrandService } from "../services/brand.service.ts";
import { BaseResponse } from "../utils/responseFormat.ts";
import { GenericControllerImpl } from "./generic-impl.controller.ts";


export class BrandController extends GenericControllerImpl<
  BrandDto,
  CreateBrandDto,
  UpdateBrandDto
> {
  brandService: BrandService;
  constructor() {
    super("brand");
    this.brandService = new BrandService();
  }

  async addBrandProducts(req: any, res: any, next: any) {
    try {
      const brandId: number = req.params.id;
      const response = await this.brandService.addRemoveProducts(
        Number(brandId),
        req.body,
        true
      );
      res
        .status(200)
        .json(new BaseResponse(200, "Brand products added", response));
    } catch (error) {
      next(error);
    }
  }

  async removeBrandProducts(req: any, res: any, next: any) {
    try {
      const brandId: number = req.params.id;
      const response = await this.brandService.addRemoveProducts(
        Number(brandId),
        req.body,
        false
      );
      res
        .status(200)
        .json(new BaseResponse(200, "Brand products removed", response));
    } catch (error) {
      next(error);
    }
  }
}
