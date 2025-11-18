export class UpdateCategoryDto {
    name: string;
    description: string;
    active: boolean;

    constructor(
        name: string,
        description: string,
        active: boolean 
    ) {
        this.name = name;
        this.description = description;
        this.active = active
    }
}