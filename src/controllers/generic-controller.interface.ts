
export default interface GenericControllerInterface {
    findAll(req: any, res: any, next: any): any;
    findOne(req: any, res: any, next: any): any;
    create(req: any, res: any, next: any): any;
    update(req: any, res: any, next: any): any;
    deactivate(req: any, res: any, next: any): any;
    activate(req: any, res: any, next: any): any;
}