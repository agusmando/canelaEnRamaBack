export class CreateSupplierDto {
    name: string;
    contact?: string;

    constructor(
        name: string, 
        contact: string,
    ) {
        this.name = name;
        this.contact = contact;
    }
}