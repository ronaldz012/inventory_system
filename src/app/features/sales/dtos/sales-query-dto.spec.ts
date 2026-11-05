import { SaleReturnStatus, SaleType } from './sale-detail-dto';
import {
  cleanSalesFilter,
  parseSalesQuery,
  SALES_QUERY_DEFAULTS,
  sameSalesQuery,
  serializeSalesQuery,
} from './sales-query-dto';

describe('sales-query-dto', () => {
  describe('cleanSalesFilter', () => {
    it('quita el `#` y los espacios que agrega la UI', () => {
      expect(cleanSalesFilter('  #28 ')).toBe('28');
    });

    it('trata vacío y solo `#` como sin filtro', () => {
      expect(cleanSalesFilter('')).toBeUndefined();
      expect(cleanSalesFilter('   ')).toBeUndefined();
      expect(cleanSalesFilter('#')).toBeUndefined();
      expect(cleanSalesFilter(undefined)).toBeUndefined();
    });

    it('conserva texto libre y SKU', () => {
      expect(cleanSalesFilter('nike air')).toBe('nike air');
      expect(cleanSalesFilter('#SKU-001')).toBe('SKU-001');
    });
  });

  describe('parseSalesQuery', () => {
    it('aplica los defaults cuando la URL está vacía', () => {
      expect(parseSalesQuery({})).toEqual({
        filter: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        type: SaleType.Sale,
        returnStatus: undefined,
        page: SALES_QUERY_DEFAULTS.page,
        pageSize: SALES_QUERY_DEFAULTS.pageSize,
      });
    });

    it('lee búsqueda, fecha y paginación', () => {
      const q = parseSalesQuery({
        filter: '#28',
        dateFrom: '2026-11-01T04:00:00.000Z',
        dateTo: '2026-11-02T03:59:59.999Z',
        page: '3',
        pageSize: '20',
      });

      expect(q.filter).toBe('28');
      expect(q.dateFrom).toBe('2026-11-01T04:00:00.000Z');
      expect(q.dateTo).toBe('2026-11-02T03:59:59.999Z');
      expect(q.page).toBe(3);
      expect(q.pageSize).toBe(20);
      expect(q.type).toBe(SaleType.Sale);
    });

    it('solo `type=1` abre la vista de devoluciones', () => {
      expect(parseSalesQuery({ type: '1' }).type).toBe(SaleType.Return);
      expect(parseSalesQuery({ type: '0' }).type).toBe(SaleType.Sale);
      expect(parseSalesQuery({ type: 'otro' }).type).toBe(SaleType.Sale);
    });

    it('descarta el estado de devolución en la vista de devoluciones', () => {
      expect(parseSalesQuery({ type: '1', returnStatus: '2' }).returnStatus).toBeUndefined();
    });

    it('acepta los tres estados de devolución y descarta el resto', () => {
      expect(parseSalesQuery({ returnStatus: '0' }).returnStatus).toBe(SaleReturnStatus.None);
      expect(parseSalesQuery({ returnStatus: '1' }).returnStatus).toBe(SaleReturnStatus.Partial);
      expect(parseSalesQuery({ returnStatus: '2' }).returnStatus).toBe(SaleReturnStatus.Full);
      expect(parseSalesQuery({ returnStatus: '9' }).returnStatus).toBeUndefined();
      expect(parseSalesQuery({ returnStatus: '' }).returnStatus).toBeUndefined();
    });

    it('tolera números inválidos de paginación', () => {
      const q = parseSalesQuery({ page: 'abc', pageSize: '' });
      expect(q.page).toBe(1);
      expect(q.pageSize).toBe(10);
    });
  });

  describe('serializeSalesQuery', () => {
    const base = {
      type: SaleType.Sale,
      page: SALES_QUERY_DEFAULTS.page,
      pageSize: SALES_QUERY_DEFAULTS.pageSize,
    };

    it('omite los defaults (URL limpia)', () => {
      expect(serializeSalesQuery({ ...base })).toEqual({
        filter: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        type: undefined,
        returnStatus: undefined,
        page: undefined,
        pageSize: undefined,
      });
    });

    it('marca devoluciones con type=1 y conserva filtros', () => {
      const out = serializeSalesQuery({
        ...base,
        type: SaleType.Return,
        filter: '  #28 ',
        page: 2,
      });

      expect(out.type).toBe(SaleType.Return);
      expect(out.filter).toBe('28');
      expect(out.page).toBe(2);
    });

    it('descarta el estado de devolución en la vista de devoluciones', () => {
      const out = serializeSalesQuery({
        ...base,
        type: SaleType.Return,
        returnStatus: SaleReturnStatus.Full,
      });

      expect(out.returnStatus).toBeUndefined();
    });

    it('conserva el estado de devolución en ventas', () => {
      const out = serializeSalesQuery({ ...base, returnStatus: SaleReturnStatus.Partial });
      expect(out.returnStatus).toBe(SaleReturnStatus.Partial);
    });

    it('conserva un pageSize distinto al default', () => {
      expect(serializeSalesQuery({ ...base, pageSize: 20 }).pageSize).toBe(20);
    });
  });

  describe('sameSalesQuery', () => {
    const q = parseSalesQuery({ filter: '28' });

    it('compara todos los campos', () => {
      expect(sameSalesQuery(q, parseSalesQuery({ filter: '28' }))).toBe(true);
      expect(sameSalesQuery(q, parseSalesQuery({ filter: '28', page: '2' }))).toBe(false);
      expect(sameSalesQuery(q, parseSalesQuery({ filter: '29' }))).toBe(false);
    });
  });
});
