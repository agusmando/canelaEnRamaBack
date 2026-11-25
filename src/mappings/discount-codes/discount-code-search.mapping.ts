export const discountCodeSearchQueryMapping = {
  ofuscatedId: { field: "id", type: "number" },
  code: { field: "code", type: "string" },
  description: { field: "description", type: "string" },
  discountType: { field: "discountType", type: "enum" },
  from: { field: "startTime", type: "date", operation: "gte" },
  to: { field: "finishTime", type: "date", operation: "lte" },
  active: { field: "active", type: "boolean" },
};
