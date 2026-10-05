import { convertToParamMap } from '@angular/router';
import {
  asEnum,
  asNumber,
  asOptionalBool,
  asOptionalString,
  readQuery,
  writeQuery,
} from './list-query';

describe('list-query', () => {
  describe('readQuery', () => {
    it('convierte el ParamMap en objeto plano', () => {
      const params = convertToParamMap({ filter: 'nike', page: '3' });
      expect(readQuery(params)).toEqual({ filter: 'nike', page: '3' });
    });

    it('tolera null/undefined', () => {
      expect(readQuery(null)).toEqual({});
      expect(readQuery(undefined)).toEqual({});
    });
  });

  describe('writeQuery', () => {
    it('navega con merge y replaceUrl (la lista queda en una sola entrada)', () => {
      const navigate = vi.fn();
      const router = { navigate } as never;
      const route = {} as never;

      writeQuery(router, route, { filter: 'nike', page: undefined });

      expect(navigate).toHaveBeenCalledWith([], {
        relativeTo: route,
        queryParams: { filter: 'nike', page: undefined },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  });

  describe('asNumber', () => {
    it('parsea números y cae al default en valores inválidos', () => {
      expect(asNumber('3', 1)).toBe(3);
      expect(asNumber('0', 1)).toBe(0);
      expect(asNumber('abc', 1)).toBe(1);
      expect(asNumber('', 1)).toBe(1);
      expect(asNumber(undefined, 10)).toBe(10);
      expect(asNumber('NaN', 7)).toBe(7);
    });
  });

  describe('asOptionalBool', () => {
    it('acepta true/1 y devuelve undefined si no está', () => {
      expect(asOptionalBool('true')).toBe(true);
      expect(asOptionalBool('1')).toBe(true);
      expect(asOptionalBool('false')).toBe(false);
      expect(asOptionalBool(undefined)).toBeUndefined();
    });
  });

  describe('asEnum', () => {
    const Allowed = [0, 1, 2] as const;

    it('valida contra los permitidos (incluye el 0)', () => {
      expect(asEnum('2', Allowed, 0)).toBe(2);
      expect(asEnum('0', Allowed, 1)).toBe(0);
      expect(asEnum('99', Allowed, 1)).toBe(1);
      expect(asEnum('x', Allowed, 1)).toBe(1);
      expect(asEnum(undefined, Allowed, 1)).toBe(1);
    });
  });

  describe('asOptionalString', () => {
    it('trata vacío y whitespace como ausente', () => {
      expect(asOptionalString('nike')).toBe('nike');
      expect(asOptionalString('')).toBeUndefined();
      expect(asOptionalString('   ')).toBeUndefined();
      expect(asOptionalString(undefined)).toBeUndefined();
    });
  });
});
