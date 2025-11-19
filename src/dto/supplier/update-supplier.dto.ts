export class UpdateSupplierDto {
    name: string;
    contact?: string;
    active: boolean;

    constructor(
        id: number, 
        name: string, 
        contact: string,
        active: boolean
        
    ) {
        this.name = name;
        this.contact = contact;
        this.active = active
    }
}