
export class UpdateTagDto {
    name: string;
    active: boolean;
    constructor(name: string, active: boolean) {
        this.name = name;
        this.active = active;
    }
}