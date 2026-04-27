import {inject, Injectable} from '@angular/core';
import {CookieService} from 'ngx-cookie-service';
import {Observable, tap} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../../environments/environment';
import LoginResponse, {Module} from './interfaces/Respones/LoginResponse';
import {BranchContextService} from './branch-context-service';
import {CurrentUserService} from './current-user-service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly cookieService = inject(CookieService);
  private readonly currentUserService = inject(CurrentUserService);
  private readonly branchContext = inject(BranchContextService);
  private readonly http = inject(HttpClient);
  private readonly url = environment.BACKEND_URL + '/api/Auth';
  private readonly TOKEN_KEY = 'auth_token';

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.url + '/Login', { email, password }).pipe(
      tap(res => {
        if (res == null) return;
        this.cookieService.set(this.TOKEN_KEY, res.accessToken ?? '', 7, '/');
        this.currentUserService.set({
          id: res.user.id,
          userName: res.user.username,
          email: res.user.email,
        });
        this.branchContext.initialize(res.branches);
      }),
    );
  }

  logout(): void {
    this.cookieService.delete(this.TOKEN_KEY, '/');
    this.currentUserService.clear();
    this.branchContext.clear();
  }

  getModules(): Module[] {
    const modules = this.branchContext.getActiveModules();
    if (modules.length > 0) return modules;
    this.logout();
    return [];
  }
}
