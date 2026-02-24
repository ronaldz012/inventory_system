import "reflect-metadata";

export default interface LoginResponse {
   accessToken?: string;
   refreshToken?: string;
   tokenType?: string;
   expiresIn?: number;
   status?: string;
   authProvider?: string;
   user: User;
   roles?: string[];
   modules?: Module[];
}

export interface User {
   id: number;
   username: string;
   email: string;
   name: string;
   firstName: string;
   lastName: string;
}

export interface Module {
   id?: number;
   name?: string;
   canCreate?: boolean;
   canRead?: boolean;
   canUpdate?: boolean;
   canDelete?: boolean;
   menus?: Menus[];
}

export interface Menus {
   id?: number;
   parentMenuId?: number;
   name?: string;
   route?: string;
   icon?: string;
   order?: number;
   moduleId?: number;
}
