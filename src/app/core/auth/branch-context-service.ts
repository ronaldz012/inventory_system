import {Injectable, signal} from '@angular/core';
import {Branch, Module} from './interfaces/Respones/LoginResponse';

@Injectable({
  providedIn: 'root',
})
export class BranchContextService {
  private readonly _available = signal<Branch[]>([]);
  private readonly _active = signal<Branch | null>(null);

  readonly available = this._available.asReadonly();
  readonly active = this._active.asReadonly();
  private ACTIVE_BRANCH_ID_KEY = 'active_branch_id'
  private BRANCHES_KEY = 'branches'

  setAvailable(branches: Branch[]): void {
    this._available.set(branches);
  }

  setActive(branch: Branch): void {
    this._active.set(branch);
    localStorage.setItem(this.ACTIVE_BRANCH_ID_KEY, String(branch.branchId));
  }

  // para el interceptor
  getActiveBranchId(): string | null {
    return this._active()?.branchId?.toString() ?? null;
  }

  // para estadísticas: pasa los branches que quieras
  getBranchIds(branches: Branch[]): string {
    return branches.map(b => b.branchId).join(',');
  }

  // restaurar desde localStorage al arrancar la app
  restoreFromStorage(branches: Branch[]): void {
    const savedId = localStorage.getItem(this.ACTIVE_BRANCH_ID_KEY);
    const saved = branches.find(b => b.branchId === Number(savedId));
    this._available.set(branches);
    this._active.set(saved ?? branches[0] ?? null);
  }


  // Reemplaza setAvailable + setActive + localStorage suelto
  initialize(branches: Branch[]): void {
    localStorage.setItem(this.BRANCHES_KEY, JSON.stringify(branches));
    this._available.set(branches);

    const savedId = Number(localStorage.getItem(this.ACTIVE_BRANCH_ID_KEY));
    const saved = branches.find(b => b.branchId === savedId);
    this._active.set(saved ?? branches[0] ?? null);

    if (this._active()) {
      localStorage.setItem(this.ACTIVE_BRANCH_ID_KEY, String(this._active()!.branchId));
    }
  }

  clear(): void {
    localStorage.removeItem(this.BRANCHES_KEY);
    //localStorage.removeItem('active_branch_id');
    this._available.set([]);
    this._active.set(null);
  }

  getActiveModules(): Module[] {
    return this._active()?.modules ?? [];
  }
}
