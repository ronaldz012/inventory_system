import "reflect-metadata";

export default interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  status: string;
  authProvider: string;
  user: User;
  branches: Branch[];
}

export interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
}

export interface Branch {
  branchId: number;
  branchName: string;
  roles: Role[];
  modules: Module[];
}

export interface Role {
  id: number;
  name: string;
}

export interface Module {
  id: number;
  name: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  menus: Menu[];
}

export interface Menu {
  id: number;
  parentMenuId: number;
  name: string;
  route: string;
  icon: string;
  order: number;
  moduleId: number;
}
