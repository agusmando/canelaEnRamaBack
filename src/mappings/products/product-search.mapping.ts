export const productSearchQueryMapping = {
  ofuscatedId: { field: "id", type: "number" },
  name: { field: "name", type: "string" },
  description: { field: "description", type: "string" },
  ofuscatedMeasure: { field: "measure", type: "object" },
  active: { field: "active", type: "boolean" },
  category: { field: "Category", type: "object", childField: "name"},
  tags: { field: "Tags", type: "relationArray", childField: "name" },
  brand: { field: "Brand", type: "object", childField: "name" },
  variants: {
    field: "variants",
    type: "relationArray",
    childField: "name",
    expand: ["hasComponents", "isComponentOf", "offers"],
  },
  ofuscatedOffers: { field: "offers", type: "relationArray", childField: "id" },
};
