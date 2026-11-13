import { BannerDto, type BannerInput } from "../dto/banner/banner.dto.js";
import { BannerService } from "../services/banner.service.js";
import { BaseResponse } from "../utils/responseFormat.js";
import { GenericControllerImpl, parseId } from "./generic-impl.controller.js";

export class BannerController extends GenericControllerImpl<BannerDto, BannerInput, BannerInput> {
  readonly bannerService: BannerService;

  constructor(bannerService = new BannerService()) {
    super(bannerService);
    this.bannerService = bannerService;
  }

  async placements(_req: any, res: any) {
    res.status(200).json(new BaseResponse(200, "Banner placements", this.bannerService.placements()));
  }

  async listPublic(req: any, res: any, next: any) {
    try {
      const response = await this.bannerService.listPublic(req.query.placement);
      res.status(200).json(new BaseResponse(200, "Banners", response));
    } catch (error) {
      next(error);
    }
  }

  async create(req: any, res: any, next: any) {
    try {
      const response = await this.bannerService.createBanner(req.body, req.files);
      res.status(201).json(new BaseResponse(201, "Banner created", response));
    } catch (error) {
      next(error);
    }
  }

  async update(req: any, res: any, next: any) {
    try {
      const response = await this.bannerService.updateBanner(parseId(req.params.id), req.body, req.files);
      res.status(200).json(new BaseResponse(200, "Banner updated", response));
    } catch (error) {
      next(error);
    }
  }

  async reorder(req: any, res: any, next: any) {
    try {
      const response = await this.bannerService.reorder(req.body);
      res.status(200).json(new BaseResponse(200, "Banners reordered", response));
    } catch (error) {
      next(error);
    }
  }

  async remove(req: any, res: any, next: any) {
    try {
      await this.bannerService.deleteBanner(parseId(req.params.id));
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
}
