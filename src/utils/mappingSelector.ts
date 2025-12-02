export default function mappingSelector(entity: string) {
  console.log("Selecting mapping for entity:", entity);
  switch (entity) {
    case "product":
      return {
        search: import("../mappings/products/product-search.mapping.ts").then(
          (module) => module.productSearchQueryMapping
        ),
        create: import("../mappings/products/products-create.mapping.ts").then(
          (module) => module.productCreateMapping
        ),
        update: import("../mappings/products/product-update.mapping.ts").then(
          (module) => module.productUpdateMapping
        ),
        post: import(
          "../mappings/products/product-post-procesing.mapping.ts"
        ).then((module) => module.productPostProcessingQueryMapping),
      };
    case "tag":
      return {
        search: import("../mappings/tags/tag-search.mapping.ts").then(
          (module) => module.tagSearchQueryMapping
        ),
        // create: import('../mappings/products/products-create.mapping.ts').then(module => module.productCreateMapping)
      };
    case "category":
      return {
        search: import("../mappings/category/category-search.mappings.ts").then(
          (module) => module.categorySearchQueryMapping
        ),
      };
    case "supplier":
      return {
        search: import(
          "../mappings/suppliers/suppliers-search.mapping.ts"
        ).then((module) => module.supplierSearchQueryMapping),
      };
    case "stockMovement":
      return {
        search: import(
          "../mappings/movements/movements-search.mapping.ts"
        ).then((module) => module.movementSearchQueryMapping),
      };
  }

  // throw new Error(`No mapping found for entity: ${entity}`);
}
