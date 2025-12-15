export const productCreateMapping = {
  Tags: { relation: true, connectField: "id", allowCreate: false },
  variants: { relation: true, connectField: "id", allowCreate: true },
};
