import { Gif } from "../interfaces/gif.interface";
import { GiphyItem } from "../interfaces/giphyResponse";

export class Gifmapper {
    static mapGipgyItemToGif(item:GiphyItem) : Gif{
        return{
            id:item.id,
            title:item.title,
            url:item.images.original.url,
        }
    }
    static mapGiphyItemsToGifArray(items:GiphyItem[]):Gif[]{
        return items.map(this.mapGipgyItemToGif)
    }
 }
