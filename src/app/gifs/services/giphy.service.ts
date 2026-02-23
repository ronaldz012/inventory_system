import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { GiphyRespones } from '../interfaces/giphyResponse';
import { Gif } from '../interfaces/gif.interface';
import { Gifmapper } from '../mapper/gif.mapper';

@Injectable({
  providedIn: 'root'
})
export class GiphyService {
  private  http = inject(HttpClient)

  /**
   *
   */

  trendingGifs = signal<Gif[]>([])
  constructor() {
    this.loadTrendingGifs();
    
  }

  loadTrendingGifs(){
    this.http.get<GiphyRespones>(`${environment.giphyUrl}/gifs/trending`,{
      params:{
        api_key: environment.giphyApiKey,
        limi:20,
        offset:0,
        rating:'g',
        bundle:'message_non_clip'
      }
    }).subscribe((resp)=>{
        const gifs = Gifmapper.mapGiphyItemsToGifArray(resp.data);
        this.trendingGifs.set(gifs);
        console.log(gifs);

    })
  }
}
