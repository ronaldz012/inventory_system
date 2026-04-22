import {Component, inject} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {AuthService} from '../../auth-service';
import {Router} from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './login.html',
  styles: ``,
})
export default class Login {
  // En tu componente
  loginForm = new FormGroup({
    email: new FormControl('', { validators: [Validators.required, Validators.email], nonNullable: true }),
    password: new FormControl('', { validators: [Validators.required, Validators.minLength(4)], nonNullable: true }),
  });

  private authService = inject(AuthService);
  private router = inject(Router);

  onSubmit(){
    if(this.loginForm.valid)
    {
      this.authService.login(this.loginForm.value.email!, this.loginForm.value.password!).subscribe(
        {
          next:() => this.router.navigate(['/dashboard']),
          error:() => alert('error al loguear')
        }
      )
    }
  }
}
