export const offerCreateMapping = {
  ProductVariant: { relation: true, connectField: "id", allowCreate: false },
  Product: { relation: true, connectField: "id", allowCreate: false },
};
