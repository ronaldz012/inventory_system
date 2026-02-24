import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from "@angular/router";
import {Module} from '../../../../../core/auth/interfaces/Respones/LoginResponse';

@Component({
  selector: 'app-side-menu-option',
  imports: [RouterLink],
  templateUrl: './side-menu-option.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SideMenuOption {
  modules = input.required<Module[]>()

}
