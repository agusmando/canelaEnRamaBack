export const offerCreateMapping = {
  Category: { relation: true, connectField: "id", allowCreate: false },
  ProductVariant: { relation: true, connectField: "id", allowCreate: false },
};
