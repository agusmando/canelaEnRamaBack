export class CategoryDto {
    id: number;
    name: string;
    description: string;
    active: boolean;

    constructor(
        id: number,
        name: string,
        description: string,
        active: boolean 
    ) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.active = active
    }
}