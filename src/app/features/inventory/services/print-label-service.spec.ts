import { TestBed } from '@angular/core/testing';
import { LabelPrintService } from './print-label-service';
import { LabelData } from '../interfaces/reception-labels';
import { Gender } from '../interfaces/gender';

function sample(i: number): LabelData {
  return {
    variantId: `v${i}`,
    sku: `SKU-${i}`,
    productName: 'Zapatilla Air Max',
    brandName: 'Nike',
    size: '35',
    color: 'Azul',
    gender: Gender.Unisex,
    price: 120,
    receptionId: 'r1',
  };
}

describe('LabelPrintService paginado (compacta oficial 23x38.8)', () => {
  let service: LabelPrintService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LabelPrintService);
  });

  it('A4: 56 etiquetas = 1 hoja, 57 = 2 hojas', async () => {
    const one = await service.generatePdfCompact(Array.from({ length: 56 }, (_, i) => sample(i)));
    expect(one.getNumberOfPages()).toBe(1);
    const two = await service.generatePdfCompact(Array.from({ length: 57 }, (_, i) => sample(i)));
    expect(two.getNumberOfPages()).toBe(2);
  }, 60000);

  it('respeta A5 (24) y A6 (12)', async () => {
    const a5 = await service.generatePdfCompact(Array.from({ length: 25 }, (_, i) => sample(i)), 'a5');
    expect(a5.getNumberOfPages()).toBe(2);
    const a6 = await service.generatePdfCompact(Array.from({ length: 13 }, (_, i) => sample(i)), 'a6');
    expect(a6.getNumberOfPages()).toBe(2);
  }, 60000);
});
