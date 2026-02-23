import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GifItem } from "../gif-item/gif-item";
import { Gif } from '../../../interfaces/gif.interface';

@Component({
  selector: 'app-gif-list-item',
  imports: [GifItem, GifItem],
  templateUrl: './gif-list-item.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GifListItem { 

  Gifs = input.required<Gif[]>();
}
