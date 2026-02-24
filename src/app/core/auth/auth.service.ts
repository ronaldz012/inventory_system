import {inject, Injectable} from '@angular/core';
import {CookieService} from 'ngx-cookie-service';
import {BehaviorSubject, Observable, tap} from 'rxjs';
import {User} from './interfaces/user';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../../environments/environment';
import LoginResponse, {Module} from './interfaces/Respones/LoginResponse';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private cookieService = inject(CookieService);
  private http= inject(HttpClient);
  private url = environment.BACKEND_URL + '/api/Auth';

  private currentUser = new BehaviorSubject<User | null>(null);





  //LOGIN
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.url+'/Login',{
      email:email,
      password:password,
    }).pipe(
      tap(res => {
        if( res !=null)
        {
          console.log(`logged in STATUS CODE `); // CHECK HOW TO GET THE STATUS RESPONSE
          this.cookieService.set('auth_token', res.accessToken ?? "",7, '/');
          localStorage.setItem('user_modules', JSON.stringify(res.modules));
          this.currentUser.next({id:res.user.id, user_name: (res.user.firstName + res.user.lastName), email: res.user.email});
        }
      }),
    );
  };
  //LOG OUT
  logout() {
    console.log('logged out');
  }
  //MODULES
  // auth.service.ts
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
