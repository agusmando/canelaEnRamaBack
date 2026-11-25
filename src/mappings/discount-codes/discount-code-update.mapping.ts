export const discountCodeUpdateMapping = {
  code: { field: "code" },
  description: { field: "description" },
  discountType: { field: "discountType" },
  discountValue: { field: "discountValue", parseFloat: true },
  maxDiscountAmount: { field: "maxDiscountAmount", parseFloat: true },
  minOrderAmount: { field: "minOrderAmount", parseFloat: true },
  usageLimit: { field: "usageLimit", parseInt: true },
  perUserLimit: { field: "perUserLimit", parseInt: true },
  startTime: { field: "startTime" },
  finishTime: { field: "finishTime" },
  active: { field: "active" },
};
