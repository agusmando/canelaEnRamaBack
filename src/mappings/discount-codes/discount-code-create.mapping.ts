export const discountCodeCreateMapping = {
  discountValue: { parseFloat: true },
  maxDiscountAmount: { parseFloat: true },
  minOrderAmount: { parseFloat: true },
  usageLimit: { parseInt: true },
  perUserLimit: { parseInt: true },
  usedCount: { parseInt: true },
  active: { parseBoolean: true },
};
