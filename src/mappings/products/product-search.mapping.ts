export const productSearchQueryMapping = {
  ofuscatedId: { field: "id", type: "number" },
  q: {
    type: "search",
    fields: [
      { field: "name" },
      { field: "description" },
      { field: "Category", childField: "name" },
      { field: "Brand", childField: "name" },
      { field: "Tags", childField: "name", relation: "some" },
      { field: "variants", childField: "name", relation: "some" },
    ],
  },
  name: { field: "name", type: "string" },
  description: { field: "description", type: "string" },
  ofuscatedMeasure: { field: "measure", type: "string" },
  active: { field: "active", type: "boolean" },
  category: { field: "Category", type: "object", childField: "name"},
  tags: { field: "Tags", type: "relationArray", childField: "name" },
  brand: { field: "Brand", type: "object", childField: "name" },
  variants: {
    field: "variants",
    type: "relationArray",
    childField: "name",
    expand: ["hasComponents", "isComponentOf", "offers", "images"],
  },
  ofuscatedOffers: { field: "offers", type: "relationArray", childField: "id" },
};
