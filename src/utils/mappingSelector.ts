
export default function mappingSelector(entity: string) { 
    console.log('Selecting mapping for entity:', entity)
    switch (entity) {
        case 'product':
            return {
                search: import('../mappings/products/product-search.mapping.ts').then(module => module.productSearchQueryMapping),
                create: import('../mappings/products/products-create.mapping.ts').then(module => module.productCreateMapping)
            }
        case 'tag':
            return {
                search: import('../mappings/tags/tag-search.mapping.ts').then(module => module.tagSearchQueryMapping),
                // create: import('../mappings/products/products-create.mapping.ts').then(module => module.productCreateMapping)
            }
        // case 'category':
        //     return import('../mappings/category.mapping.ts').then(module => module.categoryQueryMapping);
    }

    // throw new Error(`No mapping found for entity: ${entity}`);
} 