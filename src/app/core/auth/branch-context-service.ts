import {Injectable, signal} from '@angular/core';
import {Branch} from './interfaces/Respones/LoginResponse';

@Injectable({
  providedIn: 'root',
})
export class BranchContextService {
  private readonly _available = signal<Branch[]>([]);
  private readonly _active = signal<Branch | null>(null);

  readonly available = this._available.asReadonly();
  readonly active = this._active.asReadonly();

  setAvailable(branches: Branch[]): void {
    this._available.set(branches);
  }

  setActive(branch: Branch): void {
    this._active.set(branch);
    localStorage.setItem('active_branch_id', String(branch.branchId));
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
    const savedId = localStorage.getItem('active_branch_id');
    const saved = branches.find(b => b.branchId === Number(savedId));
    this._available.set(branches);
    this._active.set(saved ?? branches[0] ?? null);
  }
}
