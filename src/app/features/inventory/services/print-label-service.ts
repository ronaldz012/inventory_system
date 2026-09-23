import { Injectable } from '@angular/core';
import { LabelData } from '../interfaces';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

type CodeType = 'qr' | 'barcode';

/** Formatos de hoja soportados para etiquetas. */
export type SheetFormat = 'a4' | 'a5' | 'a6';

const SHEET_MM: Record<SheetFormat, { w: number; h: number }> = {
  a4: { w: 210, h: 297 },
  a5: { w: 148, h: 210 },
  a6: { w: 105, h: 148 },
};

/** Grilla compacta resuelta para un formato de hoja. */
interface CompactLayout {
  pageW: number;
  pageH: number;
  leftMargin: number;
  topMargin: number;
  columns: number;
  rows: number;
  labelsPerSheet: number;
}

/** Dimensiones de etiqueta compacta (V1 oficial 23x38, V2 experimental 23x38.8). */
interface CompactDims {
  topMargin: number;
  bottomMargin: number;
  minSideMargin: number;
  labelWidth: number;
  labelHeight: number;
  gap: number;
  padding: number;
}

@Injectable({
  providedIn: 'root',
})
export class LabelPrintService {
  private readonly CONFIG = {
    leftMargin: 12,
    topMargin: 6,
    labelWidth: 60,
    labelHeight: 32,
    gap: 1,
    columns: 3,
    labelsPerSheet: 24,
  };

  /**
   * Etiqueta compacta oficial 23x38.8mm, formato vertical:
   * QR (arriba, 19mm) -> SKU legible -> nombre (1-2 líneas, 7→5) ->
   * talla protagonista (13→9 bold) -> color (9→6.5 bold).
   * Jerarquía por distancia de lectura: talla > color > nombre (convención retail).
   * Pensada para espacios reducidos donde el barcode ya no es viable (ver
   * cálculo de módulos CODE128 vs QR para SKUs tipo NIK12-011).
   * La grilla (columnas/filas) se resuelve dinámicamente según el formato
   * de hoja (ver resolveCompactLayout).
   */
  private readonly COMPACT_LABEL: CompactDims = {
    topMargin: 20,
    bottomMargin: 5,
    minSideMargin: 5,
    labelWidth: 23,
    labelHeight: 38.8,
    gap: 0,
    padding: 1,
  };

  /**
   * Calcula cuántas etiquetas entran en la hoja y con qué márgenes.
   * La grilla se centra horizontalmente para aprovechar cada formato.
   * Etiquetas unidas (gap 0) con borde como guía de corte.
   * A4 → 8x7 = 56 · A5 → 6x4 = 24 · A6 → 4x3 = 12.
   */
  private resolveCompactLayout(format: SheetFormat, dims: CompactDims = this.COMPACT_LABEL): CompactLayout {
    const { w: pageW, h: pageH } = SHEET_MM[format];
    const { labelWidth: lw, labelHeight: lh, gap, topMargin, bottomMargin, minSideMargin } = dims;

    const columns = Math.max(1, Math.floor((pageW - minSideMargin * 2 + gap) / (lw + gap)));
    const gridW = columns * lw + (columns - 1) * gap;
    const leftMargin = (pageW - gridW) / 2;

    const rows = Math.max(1, Math.floor((pageH - topMargin - bottomMargin + gap) / (lh + gap)));

    return { pageW, pageH, leftMargin, topMargin, columns, rows, labelsPerSheet: columns * rows };
  }

  // ============================================================
  // API EXISTENTE (etiquetas grandes 60x32mm, QR o barcode)
  // ============================================================

  public async generatePdf(labels: LabelData[]): Promise<jsPDF> {
    return this.generateWithCode(labels, 'qr');
  }

  public async generatePdfWithBarcode(labels: LabelData[]): Promise<jsPDF> {
    return this.generateWithCode(labels, 'barcode');
  }

  private async generateWithCode(labels: LabelData[], codeType: CodeType): Promise<jsPDF> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    for (let i = 0; i < labels.length; i++) {
      if (i > 0 && i % this.CONFIG.labelsPerSheet === 0) {
        doc.addPage();
      }
      await this.drawLabel(doc, labels[i], i, codeType);
    }

    return doc;
  }

  private async drawLabel(
    doc: jsPDF,
    label: LabelData,
    globalIndex: number,
    codeType: CodeType,
  ): Promise<void> {
    const { x, y } = this.calculatePosition(globalIndex);

    this.drawBorder(doc, x, y);
    if (codeType === 'qr') {
      await this.drawQr(doc, label.sku, x, y);
      this.drawSku(doc, label.sku, x, y);
      this.drawProductInfo(doc, label, x, y);
      this.drawSizeBadge(doc, label.size.toString(), x, y);
      this.drawPrice(doc, label.price, x, y);
    } else {
      await this.drawBarcode(doc, label.sku, x, y);
      this.drawBarcodeDetails(doc, label, x, y);
    }
  }

  private calculatePosition(globalIndex: number): { x: number; y: number } {
    const indexOnSheet = globalIndex % this.CONFIG.labelsPerSheet;
    const column = indexOnSheet % this.CONFIG.columns;
    const row = Math.floor(indexOnSheet / this.CONFIG.columns);

    return {
      x: this.CONFIG.leftMargin + column * (this.CONFIG.labelWidth + this.CONFIG.gap),
      y: this.CONFIG.topMargin + row * (this.CONFIG.labelHeight + this.CONFIG.gap),
    };
  }

  private drawBorder(doc: jsPDF, x: number, y: number): void {
    doc.setDrawColor(153, 153, 153);
    doc.setLineWidth(0.3);
    doc.rect(x, y, this.CONFIG.labelWidth, this.CONFIG.labelHeight);
  }

  private async drawQr(doc: jsPDF, sku: string, x: number, y: number): Promise<void> {
    try {
      const qrBase64 = await QRCode.toDataURL(sku, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 200,
        color: { dark: '#000000', light: '#ffffff' },
      });
      doc.addImage(qrBase64, 'PNG', x + 2, y + 3, 23, 23);
    } catch (err) {
      console.error('Error generating QR for SKU: ' + sku, err);
    }
  }

  private createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width * 10;
    canvas.height = height * 10;
    canvas.style.width = `${width}mm`;
    canvas.style.height = `${height}mm`;
    return canvas;
  }

  private async drawBarcode(doc: jsPDF, sku: string, x: number, y: number): Promise<void> {
    try {
      const canvas = this.createCanvas(56, 13);
      JsBarcode(canvas, sku, {
        format: 'CODE128',
        height: 105,
        displayValue: false,
        margin: 2,
        background: '#ffffff',
      });
      const barcodeBase64 = canvas.toDataURL('image/png');
      doc.addImage(barcodeBase64, 'PNG', x + 2, y + 2, 56, 13);
    } catch (err) {
      console.error('Error generating barcode for SKU: ' + sku, err);
    }
  }

  private drawBarcodeDetails(doc: jsPDF, label: LabelData, x: number, y: number): void {
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(label.sku, x + 30, y + 17, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 58, 95);
    doc.text(label.brandName.toUpperCase(), x + 2, y + 19.5);

    const cleanName = (label.productName || '').trim();
    doc.setFontSize(this.getProductFontSize(cleanName.length));
    doc.setTextColor(17, 17, 17);
    const lines = doc.splitTextToSize(cleanName, 24);
    doc.text(lines.slice(0, 2), x + 2, y + 22);

    doc.setFillColor(0, 0, 0);
    doc.rect(x + 2, y + 26.5, 10, 5, 'F');
    doc.setFont('helvetica', 'bold');
    const sizeFontPt = this.getSizeFontSize(label.size.toString().length);
    doc.setFontSize(sizeFontPt);
    doc.setTextColor(255, 255, 255);
    const badgeCenterY = y + 26.5 + 2.5;
    doc.text(label.size.toString(), x + 7, badgeCenterY + sizeFontPt * 0.3528 * 0.36, {
      align: 'center',
    });

    doc.setFontSize(8.5);
    doc.setTextColor(51, 51, 51);
    doc.text(label.color, x + 15, y + 29.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`Bs. ${label.price}`, x + 57, y + 29.5, { align: 'right' });
  }

  private drawSku(doc: jsPDF, sku: string, x: number, y: number): void {
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(sku, x + 13.5, y + 29, { align: 'center' });
  }

  private drawProductInfo(doc: jsPDF, label: LabelData, x: number, y: number): void {
    const infoX = x + 28;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 58, 95);
    doc.text(label.brandName.toUpperCase(), infoX, y + 6);

    const cleanName = (label.productName || '').trim();
    doc.setFontSize(this.getProductFontSize(cleanName.length));
    doc.setTextColor(17, 17, 17);
    const lines = doc.splitTextToSize(cleanName, 30);
    doc.text(lines.slice(0, 2), infoX, y + 11);

    doc.setFontSize(8.5);
    doc.setTextColor(51, 51, 51);
    doc.text(label.color, infoX, y + 21);
  }

  private drawSizeBadge(doc: jsPDF, size: string, x: number, y: number): void {
    const infoX = x + 28;
    doc.setFillColor(0, 0, 0);
    doc.rect(infoX, y + 26, 10, 5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(this.getSizeFontSize(size.length));
    doc.setTextColor(255, 255, 255);
    doc.text(size, infoX + 5, y + 29.5, { align: 'center' });
  }

  private drawPrice(doc: jsPDF, price: number | string, x: number, y: number): void {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`Bs. ${price}`, x + 57, y + 30, { align: 'right' });
  }

  private getProductFontSize(length: number): number {
    if (length <= 16) return 8.5;
    if (length <= 28) return 7.8;
    return 7;
  }

  private getSizeFontSize(length: number): number {
    if (length <= 2) return 11;
    if (length <= 4) return 9;
    return 8;
  }

  // ============================================================
  // NUEVO: etiqueta compacta 2x3.5cm (solo QR, para espacios chicos)
  // ============================================================

  public async generatePdfCompact(labels: LabelData[], format: SheetFormat = 'a4'): Promise<jsPDF> {
    const layout = this.resolveCompactLayout(format);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format });

    for (let i = 0; i < labels.length; i++) {
      if (i > 0 && i % layout.labelsPerSheet === 0) {
        doc.addPage();
      }
      await this.drawCompactLabel(doc, labels[i], i, layout);
    }

    return doc;
  }

  private async drawCompactLabel(
    doc: jsPDF,
    label: LabelData,
    globalIndex: number,
    layout: CompactLayout,
  ): Promise<void> {
    const { x, y } = this.calculateCompactPosition(globalIndex, layout);
    const w = this.COMPACT_LABEL.labelWidth;
    const pad = this.COMPACT_LABEL.padding;

    this.drawCompactBorder(doc, x, y);
    await this.drawCompactQr(doc, label.sku, x, y, w, pad);
    this.drawCompactSku(doc, label.sku, x, y, w, pad);
    this.drawCompactName(doc, label.productName, x, y, w, pad);
    this.drawCompactSizeColor(doc, label, x, y, w, pad);
  }

  private calculateCompactPosition(
    globalIndex: number,
    layout: CompactLayout,
    dims: CompactDims = this.COMPACT_LABEL,
  ): { x: number; y: number } {
    const { labelWidth: lw, labelHeight: lh, gap } = dims;
    const indexOnSheet = globalIndex % layout.labelsPerSheet;
    const column = indexOnSheet % layout.columns;
    const row = Math.floor(indexOnSheet / layout.columns);

    return {
      x: layout.leftMargin + column * (lw + gap),
      y: layout.topMargin + row * (lh + gap),
    };
  }

  private drawCompactBorder(doc: jsPDF, x: number, y: number): void {
    doc.setDrawColor(153, 153, 153);
    doc.setLineWidth(0.3);
    doc.rect(x, y, this.COMPACT_LABEL.labelWidth, this.COMPACT_LABEL.labelHeight);
  }

  private async drawCompactQr(
    doc: jsPDF,
    sku: string,
    x: number,
    y: number,
    w: number,
    pad: number,
  ): Promise<void> {
    const qrSize = 19;
    const xOff = (w - qrSize) / 2;
    try {
      const qrBase64 = await QRCode.toDataURL(sku, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 300,
        color: { dark: '#000000', light: '#ffffff' },
      });
      doc.addImage(qrBase64, 'PNG', x + xOff, y + pad, qrSize, qrSize);
    } catch (err) {
      console.error('Error generating QR for SKU: ' + sku, err);
    }
  }

  private drawCompactSku(doc: jsPDF, sku: string, x: number, y: number, w: number, pad: number): void {
    doc.setFont('courier', 'bold');
    doc.setTextColor(0, 0, 0);
    const { text, fontSize } = this.fitSingleLine(doc, sku, w - pad * 2, 8.5, 6);
    doc.setFontSize(fontSize);
    doc.text(text, x + w / 2, y + 21.8, { align: 'center' });
  }

  private drawCompactName(
    doc: jsPDF,
    productName: string,
    x: number,
    y: number,
    w: number,
    pad: number,
  ): void {
    const cleanName = (productName || '').trim();
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 17, 17);
    const maxWidth = w - pad * 2;
    // Elige el mayor tamaño 7→5 que haga caber el nombre en 1-2 líneas
    let chosen: { l1: string; l2: string | null; fontSize: number } | null = null;
    for (let fs = 7; fs >= 5; fs -= 0.25) {
      doc.setFontSize(fs);
      const lines = doc.splitTextToSize(cleanName, maxWidth);
      if (lines.length === 1) {
        if (this.measureTextWidth(doc, lines[0], fs) <= maxWidth) {
          chosen = { l1: lines[0], l2: null, fontSize: fs };
          break;
        }
      } else {
        let l1 = lines[0];
        let l2 = lines[1] ?? '';
        while (l1 && this.measureTextWidth(doc, l1, fs) > maxWidth) l1 = l1.slice(0, -1);
        while (l2 && this.measureTextWidth(doc, l2, fs) > maxWidth) l2 = l2.slice(0, -1);
        if (lines.length > 2 && !l2.endsWith('…')) l2 = l2.slice(0, -1) + '…';
        if (this.measureTextWidth(doc, l1, fs) <= maxWidth && this.measureTextWidth(doc, l2, fs) <= maxWidth) {
          chosen = { l1, l2, fontSize: fs };
          break;
        }
      }
    }
    if (!chosen) {
      doc.setFontSize(5);
      const lines = doc.splitTextToSize(cleanName, maxWidth);
      let l2 = (lines[1] ?? '').slice(0, -1) + '…';
      while (l2 && this.measureTextWidth(doc, l2, 5) > maxWidth) l2 = l2.slice(0, -1) + '…';
      chosen = { l1: lines[0]?.slice(0, -1) ?? cleanName, l2, fontSize: 5 };
    }
    doc.setFontSize(chosen.fontSize);
    if (chosen.l2 === null) doc.text(chosen.l1, x + w / 2, y + 25.8, { align: 'center' });
    else {
      doc.text(chosen.l1, x + w / 2, y + 24.8, { align: 'center' });
      doc.text(chosen.l2, x + w / 2, y + 27.8, { align: 'center' });
    }
  }

  private drawCompactSizeColor(doc: jsPDF, label: LabelData, x: number, y: number, w: number, pad: number): void {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    const size = `${label.size}`;
    const sizeFit = this.fitSingleLine(doc, size, w - pad * 2, 13, 9);
    doc.setFontSize(sizeFit.fontSize);
    doc.text(sizeFit.text, x + w / 2, y + 32.5, { align: 'center' });

    const colorFit = this.fitSingleLine(doc, label.color, w - pad * 2, 9, 6.5);
    doc.setFontSize(colorFit.fontSize);
    doc.text(colorFit.text, x + w / 2, y + 36.8, { align: 'center' });
  }

  /**
   * Ajusta el tamaño de fuente (bajando desde startSize hasta minSize) para que
   * el texto entre en maxWidthMm en una sola línea. Si ni al tamaño mínimo entra,
   * trunca con "…". Usa doc.getStringUnitWidth para medir el ancho real en mm.
   */
  private fitSingleLine(
    doc: jsPDF,
    text: string,
    maxWidthMm: number,
    startSize: number,
    minSize: number,
  ): { text: string; fontSize: number } {
    let fontSize = startSize;
    while (fontSize >= minSize) {
      if (this.measureTextWidth(doc, text, fontSize) <= maxWidthMm) {
        return { text, fontSize };
      }
      fontSize -= 0.25;
    }

    let truncated = text;
    while (truncated.length > 1 && this.measureTextWidth(doc, truncated + '…', minSize) > maxWidthMm) {
      truncated = truncated.slice(0, -1);
    }
    return {
      text: truncated.length < text.length ? truncated + '…' : truncated,
      fontSize: minSize,
    };
  }

  private measureTextWidth(doc: jsPDF, text: string, fontSizePt: number): number {
    return (doc.getStringUnitWidth(text) * fontSizePt) / doc.internal.scaleFactor;
  }
}