import { convertToParamMap } from '@angular/router';
import {
  asEnum,
  asNumber,
  asOptionalBool,
  asOptionalString,
  blockNonNumericKeys,
  parseAmountInput,
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

  describe('parseAmountInput', () => {
    it('parsea números válidos', () => {
      expect(parseAmountInput('12')).toBe(12);
      expect(parseAmountInput('12.5')).toBe(12.5);
      expect(parseAmountInput('0')).toBe(0);
      expect(parseAmountInput('  7 ')).toBe(7);
    });

    it('normaliza la coma decimal', () => {
      expect(parseAmountInput('12,50')).toBe(12.5);
    });

    it('negativos y basura van a null (vacío)', () => {
      expect(parseAmountInput('-5')).toBeNull();
      expect(parseAmountInput('-0.5')).toBeNull();
      expect(parseAmountInput('abc')).toBeNull();
      expect(parseAmountInput('1e5')).toBeNull();
      expect(parseAmountInput('')).toBeNull();
      expect(parseAmountInput(null)).toBeNull();
      expect(parseAmountInput(undefined)).toBeNull();
    });
  });

  describe('blockNonNumericKeys', () => {
    const keydown = (key: string): { prevented: boolean } => {
      let prevented = false;
      blockNonNumericKeys({
        key,
        preventDefault: () => {
          prevented = true;
        },
      } as KeyboardEvent);
      return { prevented };
    };

    it('frena -, + y e', () => {
      expect(keydown('-').prevented).toBe(true);
      expect(keydown('+').prevented).toBe(true);
      expect(keydown('e').prevented).toBe(true);
      expect(keydown('E').prevented).toBe(true);
    });

    it('frena ArrowUp/ArrowDown (steppean el valor por accidente)', () => {
      expect(keydown('ArrowUp').prevented).toBe(true);
      expect(keydown('ArrowDown').prevented).toBe(true);
    });

    it('deja pasar dígitos, punto, coma y control', () => {
      for (const key of ['0', '5', '.', ',', 'Backspace', 'ArrowLeft', 'Tab', 'Enter']) {
        expect(keydown(key).prevented).toBe(false);
      }
    });
  });
});
