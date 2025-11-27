export const productSearchQueryMapping = {
    name: {field: 'name', type: 'string'},
    description: {field: 'description', type: 'string'},
    minPrice: {field: 'price', operation: 'gte', type: 'numberRange'},
    maxPrice: {field: 'price', operation: 'lte', type: 'numberRange'},
    active: {field: 'active', type: 'boolean'},
    category: {field: 'Category', type: 'object', childField: 'name'},
    tags: {field: 'Tags', type: 'relationArray', childField: 'name'},
    supplier: {field: 'Supplier', type: 'object', childField: 'name'},
    inventory: {field: 'Inventory', type: 'relationArray', childField: 'quantity'},
}