export class DiscountCodeDto {
  id: number;
  code: string;
  description?: string | null;
  discountType: string;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  usedCount: number;
  startTime: Date;
  finishTime: Date;
  active: boolean;

  constructor(
    id: number,
    code: string,
    discountType: string,
    discountValue: number,
    startTime: Date,
    finishTime: Date,
    active: boolean,
    description?: string | null,
    maxDiscountAmount?: number | null,
    minOrderAmount?: number,
    usageLimit?: number | null,
    perUserLimit?: number | null,
    usedCount?: number,
  ) {
    this.id = id;
    this.code = code;
    this.description = description;
    this.discountType = discountType;
    this.discountValue = discountValue;
    this.maxDiscountAmount = maxDiscountAmount;
    this.minOrderAmount = minOrderAmount ?? 0;
    this.usageLimit = usageLimit;
    this.perUserLimit = perUserLimit;
    this.usedCount = usedCount ?? 0;
    this.startTime = startTime;
    this.finishTime = finishTime;
    this.active = active;
  }
}
