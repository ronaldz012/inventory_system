import { Gender } from '../../interfaces/gender';
import {
  parseProductQuery,
  ProductQueryParams,
  ProductSortBy,
  sameProductQuery,
  serializeProductQuery,
} from './product-dto';

describe('product-dto query', () => {
  describe('parseProductQuery', () => {
    it('sin params devuelve los defaults', () => {
      expect(parseProductQuery({})).toEqual({
        filter: undefined,
        categoryId: undefined,
        brandId: undefined,
        gender: undefined,
        includeInactive: undefined,
        sortBy: ProductSortBy.CreatedAt,
        sortDescending: true,
        page: 1,
        pageSize: 10,
      });
    });

    it('lee todos los params de la URL', () => {
      expect(
        parseProductQuery({
          filter: 'nike',
          categoryId: 'c1',
          brandId: 'b1',
          gender: '1',
          includeInactive: 'true',
          sortBy: '1',
          sortDescending: 'false',
          page: '3',
          pageSize: '25',
        }),
      ).toEqual({
        filter: 'nike',
        categoryId: 'c1',
        brandId: 'b1',
        gender: Gender.Hombre,
        includeInactive: true,
        sortBy: ProductSortBy.Stock,
        sortDescending: false,
        page: 3,
        pageSize: 25,
      });
    });

    it('Unisex (0) se conserva: no se confunde con "ausente"', () => {
      expect(parseProductQuery({ gender: '0' }).gender).toBe(Gender.Unisex);
      expect(parseProductQuery({}).gender).toBeUndefined();
    });

    it('valores inválidos caen al default en vez de romper', () => {
      const parsed = parseProductQuery({ page: 'abc', pageSize: 'NaN', gender: '99', sortBy: '7' });
      expect(parsed.page).toBe(1);
      expect(parsed.pageSize).toBe(10);
      expect(parsed.gender).toBe(Gender.Unisex);
      expect(parsed.sortBy).toBe(ProductSortBy.CreatedAt);
      expect(parsed.sortDescending).toBe(true);
    });
  });

  describe('serializeProductQuery', () => {
    it('omite los defaults para dejar la URL limpia', () => {
      expect(serializeProductQuery({ page: 1, pageSize: 10 })).toEqual({
        filter: undefined,
        categoryId: undefined,
        brandId: undefined,
        gender: undefined,
        includeInactive: undefined,
        sortBy: undefined,
        sortDescending: undefined,
        page: undefined,
        pageSize: undefined,
      });
    });

    it('escribe solo lo que difiere del default', () => {
      expect(
        serializeProductQuery({
          filter: 'nike',
          includeInactive: true,
          page: 3,
          pageSize: 25,
        }),
      ).toEqual({
        filter: 'nike',
        categoryId: undefined,
        brandId: undefined,
        gender: undefined,
        includeInactive: true,
        sortBy: undefined,
        sortDescending: undefined,
        page: 3,
        pageSize: 25,
      });
    });

    it('con orden por stock escribe siempre la dirección', () => {
      const asc = serializeProductQuery({
        page: 1,
        pageSize: 10,
        sortBy: ProductSortBy.Stock,
        sortDescending: false,
      });
      expect(asc.sortBy).toBe(ProductSortBy.Stock);
      expect(asc.sortDescending).toBe(false);

      const desc = serializeProductQuery({
        page: 1,
        pageSize: 10,
        sortBy: ProductSortBy.Stock,
        sortDescending: true,
      });
      expect(desc.sortBy).toBe(ProductSortBy.Stock);
      expect(desc.sortDescending).toBe(true);
    });

    it('con el orden default (CreatedAt) no escribe dirección', () => {
      const query = serializeProductQuery({
        page: 1,
        pageSize: 10,
        sortBy: ProductSortBy.CreatedAt,
        sortDescending: false,
      });
      expect(query.sortBy).toBeUndefined();
      expect(query.sortDescending).toBeUndefined();
    });

    it('includeInactive=false no se escribe', () => {
      expect(
        serializeProductQuery({ page: 1, pageSize: 10, includeInactive: false }).includeInactive,
      ).toBeUndefined();
    });

    it('ida y vuelta: parse(serialize(q)) conserva los valores', () => {
      const original: ProductQueryParams = {
        filter: 'nike 42',
        categoryId: 'c1',
        gender: Gender.Mujer,
        includeInactive: true,
        sortBy: ProductSortBy.Stock,
        sortDescending: false,
        page: 4,
        pageSize: 25,
      };
      const serialized = serializeProductQuery(original);
      const raw: Record<string, string> = {};
      for (const [key, value] of Object.entries(serialized)) {
        if (value !== undefined && value !== null) raw[key] = String(value);
      }
      expect(parseProductQuery(raw)).toEqual(original);
    });
  });

  describe('sameProductQuery', () => {
    it('evita el reload cuando la URL no cambió en sustancia', () => {
      const a = parseProductQuery({ filter: 'nike' });
      const b = parseProductQuery({ filter: 'nike' });
      expect(sameProductQuery(a, b)).toBe(true);
      expect(sameProductQuery(a, parseProductQuery({ filter: 'adidas' }))).toBe(false);
      expect(sameProductQuery(a, parseProductQuery({ filter: 'nike', page: '2' }))).toBe(false);
    });

    it('distingue gendered 0 (Unisex) de ausente', () => {
      const unisex: ProductQueryParams = { page: 1, pageSize: 10, gender: Gender.Unisex };
      const absent: ProductQueryParams = { page: 1, pageSize: 10 };
      expect(sameProductQuery(unisex, absent)).toBe(false);
      expect(sameProductQuery(unisex, { ...unisex })).toBe(true);
    });
  });
});
