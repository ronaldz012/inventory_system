import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from "@angular/router";
import { Module } from '../../../../interfaces/menu';

@Component({
  selector: 'app-side-menu-option',
  imports: [RouterLink],
  templateUrl: './side-menu-option.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideMenuOption { 
  modules = input<Module[]>()

}
