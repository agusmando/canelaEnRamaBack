
export class CreateTagDto {
    name: string;
    active: boolean;
    constructor(name: string, active: boolean) {
        this.name = name;
        this.active = active;
    }
}