import { BrandDto } from "../dto/brand/brand.dto.ts";
import { CreateBrandDto } from "../dto/brand/create-brand.dto.ts";
import { UpdateBrandDto } from "../dto/brand/update-brand.dto.ts";
import { BrandService } from "../services/brand.service.ts";
import { GenericControllerImpl } from "./generic-impl.controller.ts";

const brandService = new BrandService();

export class BrandController extends GenericControllerImpl<
  BrandDto,
  CreateBrandDto,
  UpdateBrandDto
> {
  constructor() {
    super("brand");
  }

  async addBrandProducts(req: any, res: any, next: any) {
    try {
      const brandId: number = req.params.id;
      const response = await brandService.addBrandProducts(brandId, req.body);
      res.status(response.statusCode).json({ ...response });
    } catch (error) {
      next(error);
    }
  }

  async removeBrandProductsTags(req: any, res: any, next: any) {
    try {
      const brandId: number = req.params.id;
      const response = await brandService.removeBrandProduct(brandId, req.body);
      res.status(response.statusCode).json({ ...response });
    } catch (error) {
      next(error);
    }
  }
}
