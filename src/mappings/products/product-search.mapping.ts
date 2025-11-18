export const productSearchQueryMapping = {
    name: {field: 'name', type: 'string'},
    description: {field: 'description', type: 'string'},
    price: {field: 'price', type: 'string'},
    active: {field: 'active', type: 'boolean'},
    category: {field: 'Category', type: 'object', childField: 'name'},
    tags: {field: 'Tags', type: 'relationArray', childField: 'name'},
    supplier: {field: 'Supplier', type: 'object', childField: 'name'},
}