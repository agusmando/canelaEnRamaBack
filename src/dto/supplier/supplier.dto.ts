export class SupplierDto {
    id: number;
    name: string;
    contact?: string;
    createdAt: Date;
    active: boolean;

    constructor(
        id: number, 
        name: string, 
        contact: string,
        createdAt: Date,
        active: boolean
        
    ) {
        this.id = id;
        this.name = name;
        this.contact = contact;
        this.createdAt = createdAt;
        this.active = active
    }
}