import { DiscountCodeDto } from "../dto/discount-code/discount-code.dto.js";
import { CreateDiscountCodeDto } from "../dto/discount-code/create-discount-code.dto.js";
import { UpdateDiscountCodeDto } from "../dto/discount-code/update-discount-code.dto.js";
import { DiscountCodeService } from "../services/discount-code.service.js";
import { GenericControllerImpl } from "./generic-impl.controller.js";
import { BaseResponse } from "../utils/responseFormat.js";
import { getActor } from "../middleware/auth.middleware.js";

export class DiscountCodeController extends GenericControllerImpl<
  DiscountCodeDto,
  CreateDiscountCodeDto,
  UpdateDiscountCodeDto
> {
  readonly discountCodeService: DiscountCodeService;

  constructor(discountCodeService = new DiscountCodeService()) {
    super(discountCodeService);
    this.discountCodeService = discountCodeService;
  }

  /**
   * POST /discount-code/validate — vista previa del descuento para el checkout.
   * Body: { code, subtotal } (subtotal = total de productos con ofertas).
   */
  async validate(req: any, res: any, next: any) {
    try {
      const preview = await this.discountCodeService.preview(
        req.body?.code,
        req.body?.subtotal,
        getActor(req).userId,
      );
      res.status(200).json(new BaseResponse(200, "Cupón válido", preview));
    } catch (error) {
      next(error);
    }
  }
}
