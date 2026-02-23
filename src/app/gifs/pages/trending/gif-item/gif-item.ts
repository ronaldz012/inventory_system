import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Gif } from '../../../interfaces/gif.interface';

@Component({
  selector: 'app-gif-item',
  imports: [],
  template: `
    <div>
        <img class="h-full w-full rounded-base object-cover" src="{{gif().url}}" alt="{{gif().title}}">
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GifItem {

  gif = input.required<Gif>();
}
