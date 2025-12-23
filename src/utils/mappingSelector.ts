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
    case "productVariant":
      return {
        search: import(
          "../mappings/product-variants/product-variant-search.mapping.ts"
        ).then((module) => module.productVariantSearchQueryMapping),
        create: import(
          "../mappings/product-variants/product-variant-create.mapping.ts"
        ).then((module) => module.productVariantCreateMapping),
        update: import(
          "../mappings/product-variants/product-variant-update.mapping.ts"
        ).then((module) => module.productVariantUpdateMapping),
        post: import(
          "../mappings/product-variants/product-variant-post-procesing.mapping.ts"
        ).then((module) => module.productVariantPostProcessingQueryMapping),
      };
    case "brand":
      return {
        search: import("../mappings/brand/brand-search.mapping.ts").then(
          (module) => module.brandSearchQueryMapping
        ),
        create: import("../mappings/brand/brand-create.mapping.ts").then(
          (module) => module.brandCreateMapping
        ),
        update: import("../mappings/brand/brand-update.mapping.ts").then(
          (module) => module.brandUpdateMapping
        ),
        // post: import(
        //   "../mappings/brand/brand-post-procesing.mapping.ts"
        // ).then((module) => module.brandPostProcessingQueryMapping),
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
        create: import("../mappings/suppliers/supplier-create.mapping.ts").then(
          (module) => module.supplierCreateMapping
        ),
        update: import("../mappings/suppliers/supplier-update.mapping.ts").then(
          (module) => module.supplierUpdateMapping
        ),
      };
    case "stockMovement":
      return {
        search: import(
          "../mappings/movements/movements-search.mapping.ts"
        ).then((module) => module.movementSearchQueryMapping),
      };

    case "offer":
      return {
        search: import(
          "../mappings/offers/offer-search.mapping.ts"
        ).then((module) => module.offerSearchQueryMapping),
        create: import("../mappings/offers/offer-create.mapping.ts").then(
          (module) => module.offerCreateMapping
        ),
        update: import("../mappings/offers/offer-update.mapping.ts").then(
          (module) => module.productUpdateMapping
        ),
      };
  }

  // throw new Error(`No mapping found for entity: ${entity}`);
}
