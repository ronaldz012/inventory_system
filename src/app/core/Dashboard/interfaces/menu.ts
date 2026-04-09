export  interface Module{
    id:number;
    name:string;
    read:boolean;
    write:boolean;
    update:boolean;
    delete: boolean;
    menus: Menu[]

   
}
interface Menu {
    id:number;
    label:string
    route: string;
}