export const productCreateMapping = {
    // categoryId: { relation: true, connectField: 'id', allowCreate: false },
    Tags: { relation: true, connectField: 'id', allowCreate: false },
    Inventory: { relation: true, connectField: 'id', allowCreate: true },
    // supplierId: { relation: true, connectField: 'id', allowCreate: false },
}