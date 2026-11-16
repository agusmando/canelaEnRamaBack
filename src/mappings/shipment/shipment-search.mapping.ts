export const shipmentSearchQueryMapping = {
  status: { field: "status", type: "enum" },
  method: { field: "method", type: "enum" },
  orderId: { field: "orderId", type: "number" },
  trackingCode: { field: "trackingCode", type: "string" },
  carrier: { field: "carrier", type: "string" },
  createdFrom: { field: "createdAt", type: "date", operation: "gte" },
};
