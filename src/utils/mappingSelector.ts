export default function mappingSelector(entity: string) {
  console.log("Selecting mapping for entity:", entity);
  switch (entity) {
    case "product":
      return {
        search: import("../mappings/products/product-search.mapping.js").then(
          (module) => module.productSearchQueryMapping,
        ),
        create: import("../mappings/products/product-create.mapping.js").then(
          (module) => module.productCreateMapping,
        ),
        update: import("../mappings/products/product-update.mapping.js").then(
          (module) => module.productUpdateMapping,
        ),
        post: import("../mappings/products/product-post-procesing.mapping.js").then(
          (module) => module.productPostProcessingMapping,
        ),
      };
    case "productVariant":
      return {
        search:
          import("../mappings/product-variants/product-variant-search.mapping.js").then(
            (module) => module.productVariantSearchQueryMapping,
          ),
        create:
          import("../mappings/product-variants/product-variant-create.mapping.js").then(
            (module) => module.productVariantCreateMapping,
          ),
        update:
          import("../mappings/product-variants/product-variant-update.mapping.js").then(
            (module) => module.productVariantUpdateMapping,
          ),
        post: import("../mappings/product-variants/product-variant-post-procesing.mapping.js").then(
          (module) => module.productVariantPostProcessingMapping,
        ),
      };
    case "brand":
      return {
        search: import("../mappings/brand/brand-search.mapping.js").then(
          (module) => module.brandSearchQueryMapping,
        ),
        create: import("../mappings/brand/brand-create.mapping.js").then(
          (module) => module.brandCreateMapping,
        ),
        update: import("../mappings/brand/brand-update.mapping.js").then(
          (module) => module.brandUpdateMapping,
        ),
        // post: import(
        //   "../mappings/brand/brand-post-procesing.mapping.js"
        // ).then((module) => module.brandPostProcessingQueryMapping),
      };
    case "tag":
      return {
        search: import("../mappings/tags/tag-search.mapping.js").then(
          (module) => module.tagSearchQueryMapping,
        ),
        // create: import('../mappings/products/products-create.mapping.js').then(module => module.productCreateMapping)
      };
    case "category":
      return {
        search: import("../mappings/category/category-search.mappings.js").then(
          (module) => module.categorySearchQueryMapping,
        ),
      };
    case "supplier":
      return {
        search:
          import("../mappings/suppliers/suppliers-search.mapping.js").then(
            (module) => module.supplierSearchQueryMapping,
          ),
        create: import("../mappings/suppliers/supplier-create.mapping.js").then(
          (module) => module.supplierCreateMapping,
        ),
        update: import("../mappings/suppliers/supplier-update.mapping.js").then(
          (module) => module.supplierUpdateMapping,
        ),
      };
    case "stockMovement":
      return {
        search:
          import("../mappings/movements/movements-search.mapping.js").then(
            (module) => module.movementSearchQueryMapping,
          ),
      };

    case "offer":
      return {
        search: import("../mappings/offers/offer-search.mapping.js").then(
          (module) => module.offerSearchQueryMapping,
        ),
        create: import("../mappings/offers/offer-create.mapping.js").then(
          (module) => module.offerCreateMapping,
        ),
        update: import("../mappings/offers/offer-update.mapping.js").then(
          (module) => module.productUpdateMapping,
        ),
      };
    case "cart":
      return {
        search: import("../mappings/cart/cart-search.mapping.js").then(
          (module) => module.cartSearchQueryMapping,
        ),
        create: import("../mappings/cart/cart-create.mapping.js").then(
          (module) => module.cartCreateMapping,
        ),
        update: import("../mappings/cart/cart-update.mapping.js").then(
          (module) => module.cartUpdateMapping,
        ),
      };
    case "cartItem":
      return {
        create:
          import("../mappings/cart-item/cart-item-create.mapping.js").then(
            (module) => module.cartItemCreateMapping,
          ),
        update:
          import("../mappings/cart-item/cart-item-update.mapping.js").then(
            (module) => module.cartItemUpdateMapping,
          ),
      };
    case "order":
      return {
        search: import("../mappings/order/order-search.mapping.js").then(
          (module) => module.orderSearchQueryMapping,
        ),
        create: import("../mappings/order/order-create.mapping.js").then(
          (module) => module.orderCreateMapping,
        ),
        update: import("../mappings/order/order-update.mapping.js").then(
          (module) => module.orderUpdateMapping,
        ),
      };
    case "orderItem":
      return {
        create:
          import("../mappings/order-item/order-item-create.mapping.js").then(
            (module) => module.orderItemCreateMapping,
          ),
        update:
          import("../mappings/order-item/order-item-update.mapping.js").then(
            (module) => module.orderItemUpdateMapping,
          ),
      };
    case "user":
      return {
        search: import("../mappings/user/user-search.mapping.js").then(
          (module) => module.userSearchQueryMapping,
        ),
      };
  }

  // throw new Error(`No mapping found for entity: ${entity}`);
}
