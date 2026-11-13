import { GoogleReviewService } from "../services/google-review.service.js";
import { BaseResponse } from "../utils/responseFormat.js";
import { parseId } from "./generic-impl.controller.js";

export class GoogleReviewController {
  constructor(private readonly service = new GoogleReviewService()) {}

  async getPublic(_req: any, res: any, next: any) {
    try {
      res.status(200).json(new BaseResponse(200, "Google reviews", await this.service.getPublic()));
    } catch (error) {
      next(error);
    }
  }

  async getAll(_req: any, res: any, next: any) {
    try {
      res.status(200).json(new BaseResponse(200, "Google reviews", await this.service.getAll()));
    } catch (error) {
      next(error);
    }
  }

  async sync(_req: any, res: any, next: any) {
    try {
      res.status(200).json(new BaseResponse(200, "Google reviews synced", await this.service.sync()));
    } catch (error) {
      next(error);
    }
  }

  async update(req: any, res: any, next: any) {
    try {
      const response = await this.service.update(parseId(req.params.id), req.body);
      res.status(200).json(new BaseResponse(200, "Google review updated", response));
    } catch (error) {
      next(error);
    }
  }
}
