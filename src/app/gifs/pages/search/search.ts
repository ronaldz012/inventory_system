import {ChangeDetectionStrategy, Component, inject, signal,} from '@angular/core';
import {GifListItem} from '../../components/gif-list-item/gif-list-item';
import {GiphyService} from '../../services/giphy.service';
import {Gif} from '../../interfaces/gif.interface';

const imageUrls: string[] = [
    "https://flowbite.s3.amazonaws.com/docs/gallery/square/image.jpg",
    "https://flowbite.s3.amazonaws.com/docs/gallery/square/image-1.jpg",
    "https://flowbite.s3.amazonaws.com/docs/gallery/square/image-2.jpg",
    "https://flowbite.s3.amazonaws.com/docs/gallery/square/image-3.jpg",
    "https://flowbite.s3.amazonaws.com/docs/gallery/square/image-4.jpg",
    "https://flowbite.s3.amazonaws.com/docs/gallery/square/image-5.jpg",
    "https://flowbite.s3.amazonaws.com/docs/gallery/square/image-6.jpg",
    "https://flowbite.s3.amazonaws.com/docs/gallery/square/image-7.jpg",
    "https://flowbite.s3.amazonaws.com/docs/gallery/square/image-8.jpg",
    "https://flowbite.s3.amazonaws.com/docs/gallery/square/image-9.jpg",
    "https://flowbite.s3.amazonaws.com/docs/gallery/square/image-10.jpg",
    "https://flowbite.s3.amazonaws.com/docs/gallery/square/image-11.jpg",
    "https://flowbite.s3.amazonaws.com/docs/gallery/square/image-11.jpg"
];
//test for many small windows
//test for commit windows in webstorm
//this componente is for searching thing
@Component({
  selector: 'app-search',
  imports: [
    GifListItem
  ],
  templateUrl: './search.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export  default class Search {
  giphyService = inject(GiphyService);
  searchedGifs = signal<Gif[]>([]);

  OnSearch(query: string) {
    if(query.length <= 1) {return;}
    this.giphyService.searchGifs(query).subscribe(resp =>{
      this.searchedGifs.set(resp);
    });
  }

}
