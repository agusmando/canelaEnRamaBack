export class UpdateDiscountCodeDto {
  code?: string;
  description?: string | null;
  discountType?: string;
  discountValue?: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  startTime?: Date;
  finishTime?: Date;
  active?: boolean;

  constructor(
    code?: string,
    discountType?: string,
    discountValue?: number,
    startTime?: Date,
    finishTime?: Date,
    description?: string | null,
    maxDiscountAmount?: number | null,
    minOrderAmount?: number,
    usageLimit?: number | null,
    perUserLimit?: number | null,
    active?: boolean,
  ) {
    this.code = code;
    this.description = description;
    this.discountType = discountType;
    this.discountValue = discountValue;
    this.maxDiscountAmount = maxDiscountAmount;
    this.minOrderAmount = minOrderAmount;
    this.usageLimit = usageLimit;
    this.perUserLimit = perUserLimit;
    this.startTime = startTime;
    this.finishTime = finishTime;
    this.active = active;
  }
}
