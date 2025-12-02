export const productCreateMapping = {
  // categoryId: { relation: true, connectField: "id", allowCreate: false },
  Tags: { relation: true, connectField: "id", allowCreate: false },
  movements: { relation: true, connectField: "id", allowCreate: true },
  // supplierId: { relation: true, connectField: 'id', allowCreate: false },
};
