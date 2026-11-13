import { CreateReviewDto, ReviewDto, UpdateReviewDto } from "../dto/review/review.dto.js";
import { ReviewService } from "../services/review.service.js";
import { BaseResponse, PaginatedResponse } from "../utils/responseFormat.js";
import { GenericControllerImpl, parseBool, parseId } from "./generic-impl.controller.js";
import { getActor } from "../middleware/auth.middleware.js";

export class ReviewController extends GenericControllerImpl<ReviewDto, CreateReviewDto, UpdateReviewDto> {
  readonly reviewService: ReviewService;

  constructor(reviewService = new ReviewService()) {
    super(reviewService);
    this.reviewService = reviewService;
  }

  async findAll(req: any, res: any, next: any) {
    try {
      const result = await this.reviewService.list(req.query, getActor(req));
      if (parseBool(req.query.paginate)) {
        return res
          .status(200)
          .json(
            new PaginatedResponse(
              200,
              "Reviews found",
              result.entityList,
              result.currentPage,
              result.amountPerPage,
              result.totalElements,
            ),
          );
      }
      res.status(200).json(new BaseResponse(200, "Reviews found", result.entityList));
    } catch (error) {
      next(error);
    }
  }

  async summary(req: any, res: any, next: any) {
    try {
      const response = await this.reviewService.summary(req.query.productId);
      res.status(200).json(new BaseResponse(200, "Review summary", response));
    } catch (error) {
      next(error);
    }
  }

  async stats(_req: any, res: any, next: any) {
    try {
      res.status(200).json(new BaseResponse(200, "Review stats", await this.reviewService.stats()));
    } catch (error) {
      next(error);
    }
  }

  async mine(req: any, res: any, next: any) {
    try {
      const response = await this.reviewService.mine(getActor(req).userId!);
      res.status(200).json(new BaseResponse(200, "Reviews found", response));
    } catch (error) {
      next(error);
    }
  }

  async eligible(req: any, res: any, next: any) {
    try {
      const response = await this.reviewService.eligible(getActor(req).userId!, req.query.productId);
      res.status(200).json(new BaseResponse(200, "Eligible variants", response));
    } catch (error) {
      next(error);
    }
  }

  async create(req: any, res: any, next: any) {
    try {
      const response = await this.reviewService.createReview(req.body, getActor(req).userId!);
      res.status(201).json(new BaseResponse(201, "Review created", response));
    } catch (error) {
      next(error);
    }
  }

  async update(req: any, res: any, next: any) {
    try {
      const response = await this.reviewService.updateReview(
        parseId(req.params.id),
        req.body,
        getActor(req),
      );
      res.status(200).json(new BaseResponse(200, "Review updated", response));
    } catch (error) {
      next(error);
    }
  }

  async moderate(req: any, res: any, next: any) {
    try {
      const response = await this.reviewService.moderate(parseId(req.params.id), req.body);
      res.status(200).json(new BaseResponse(200, "Review moderated", response));
    } catch (error) {
      next(error);
    }
  }

  async remove(req: any, res: any, next: any) {
    try {
      await this.reviewService.remove(parseId(req.params.id), getActor(req));
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
}
