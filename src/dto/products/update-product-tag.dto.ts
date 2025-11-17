export class UpdateProductTagDto {
    tagsId: {id: number}[]

    constructor( tagsId: {id: number}[] ) {
        this.tagsId = tagsId
    }
}