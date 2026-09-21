import {Gender} from '../../interfaces/gender';
import {BulkUpdateVariantPriceItem} from './bulk-update-variant-price-dto';

export interface UpdateProductDto {
  name?:        string,
  description?: string,
  basePrice?:   number,
  gender?:      Gender ,
  categoryId?:  GUID | null,
  brandId?:     GUID | null,
  /** Actualización masiva de precios. Vacío/omitido = ignorar. */
  variantPrices?: BulkUpdateVariantPriceItem[],
}
