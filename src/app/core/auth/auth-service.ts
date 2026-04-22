import {inject, Injectable} from '@angular/core';
import {CookieService} from 'ngx-cookie-service';
import {BehaviorSubject, Observable, tap} from 'rxjs';
import {User} from './interfaces/user';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../../environments/environment';
import LoginResponse, {Module} from './interfaces/Respones/LoginResponse';
import {BranchContextService} from './branch-context-service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private cookieService = inject(CookieService);
  private http= inject(HttpClient);
  private url = environment.BACKEND_URL + '/api/Auth';
  private branchContext = inject(BranchContextService)
  private currentUser = new BehaviorSubject<User | null>(null);





  //LOGIN
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.url + '/Login', { email, password }).pipe(
      tap(res => {
        if (res == null) return;

        // auth
        this.cookieService.set('auth_token', res.accessToken ?? '', 7, '/');

        // branches disponibles
        localStorage.setItem('branches', JSON.stringify(res.branches));

        // branch activo: restaurar el último usado o tomar el primero
        const savedBranchId = localStorage.getItem('active_branch_id');
        const savedBranch = res.branches.find(b => b.branchId === Number(savedBranchId));
        const activeBranch = savedBranch ?? res.branches[0] ?? null;

        if (activeBranch) {
          localStorage.setItem('active_branch_id', String(activeBranch.branchId));
        }

        // signals
        this.currentUser.next({
          id: res.user.id,
          userName: `${res.user.firstName} ${res.user.lastName}`,
          email: res.user.email,
        });

        this.branchContext.setAvailable(res.branches);
        if (activeBranch) this.branchContext.setActive(activeBranch);
      }),
    );
  }
  //LOG OUTmodules
  logout() {
    console.log('logged out');
  }
  //MODULES
  // auth-service.ts
  getModules(): Module[] {
    const menuData = localStorage.getItem('user_modules');

    if (menuData) {
      try {
        return JSON.parse(menuData);
      } catch (e) {
        console.error("Error parseando el menú", e);
        return [];
      }
    }

    // SI ESTÁ VACÍO:
    // Opción A: Devolver un menú por defecto (ej. solo 'Home')
    // Opción B: Forzar logout porque algo anda mal
    this.logout();
    return [];
  }
}
