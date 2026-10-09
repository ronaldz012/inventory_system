import { Component, OnInit, ViewChild, signal, inject, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { closeModal, openModal } from '@shared/utils/modal-query';
import { blockNonNumericKeys } from '@shared/utils/list-query';
import { SkuInput } from '@shared/components/sku-input/sku-input';
import {
  isBarcodeApiAvailable,
  QrScannerModal,
} from '@features/sales/components/qr-scanner-modal/qr-scanner-modal';
import { form, applyEach, min, validate } from '@angular/forms/signals';
import { ProductService } from '@features/inventory/services';
import { PosCartItemCardComponent } from './pos-item/pos-item.component';
import { PosCartItem, PosSaleState } from '@features/sales/models/pos-sale-state.model';
import { ProductVariantBySkuDto } from '@features/inventory/dtos/products/product-variant-by-sku-dto';
import { CurrencyPipe } from '@angular/common';
import { PosMobilePayModal } from './pos-mobile-pay-modal/pos-mobile-pay-modal';
import { PosDesktopPayPanel } from './pos-desktop-pay-panel/pos-desktop-pay-panel';
import { PosSearchModal } from './pos-search-modal/pos-search-modal';
import { CashRegisterService } from '@features/sales/services/cash-register-service';
import { CurrentRegisterDto } from '@features/sales/dtos/current-register-dto';
import { SaleService } from '@features/sales/services/sale-service';
import { CreateSaleDto, CreateSaleItemDto } from '@features/sales/dtos/create-sale-dto';
import { ToastService } from '@core/services/toast-service';
import { PermissionService } from '@features/auth/services/permmision-service';

@Component({
  selector: 'app-pos-page',
  standalone: true,
  imports: [
    RouterLink,
    SkuInput,
    QrScannerModal,
    PosCartItemCardComponent,
    CurrencyPipe,
    PosMobilePayModal,
    PosDesktopPayPanel,
    PosSearchModal,
  ],
  templateUrl: './pos-page.html',
})
export default class PosPage implements OnInit {
  /** El template no puede llamar imports: se expone el helper tal cual. */
  readonly blockKeys = blockNonNumericKeys;
  // ── Register state ────────────────────────────────────────────────────
  registerState = signal<'loading' | 'closed' | 'open' | 'error'>('loading');
  registerError = signal<string | null>(null);
  currentRegister = signal<CurrentRegisterDto | null>(null);
  showOpenForm = signal(false);
  openingBalance = signal<number>(0);

  private cashRegisterService = inject(CashRegisterService);
  private saleService = inject(SaleService);
  private toast = inject(ToastService);
  readonly perm = inject(PermissionService);

  // ── POS state ──────────────────────────────────────────────────────────

  @ViewChild(QrScannerModal) scanner!: QrScannerModal;
  private productService = inject(ProductService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  scannerAvailable = signal(false);

  // Control de apertura para el BottomSheet de cobro en móviles
  isMobilePayOpen = signal(false);

  /** El modal de búsqueda vive en la URL (?modal=search): "atrás" lo cierra. */
  private readonly queryParams = toSignal(this.route.queryParamMap, { initialValue: null });
  isSearchOpen = computed(() => this.queryParams()?.get('modal') === 'search');

  // 1. Estado reactivo principal del POS
  posModel = signal<PosSaleState>({
    paymentMethod: null,
    transactionCode: null,
    publicName: '',
    cashReceived: 0,
    items: [],
  });

  // 2. Definición del Esquema de validación del Formulario
  posForm = form(this.posModel, (schemaPath) => {
    applyEach(schemaPath.items, (item) => {
      min(item.quantity, 1, { message: 'Mínimo 1 unidad.' });

      // Control reactivo de stock por prenda en el carrito
      validate(item.quantity, ({ value, valueOf }) => {
        if (value() > valueOf(item.stock)) {
          return { kind: 'outOfStock', message: 'Supera el stock.' };
        }
        return null;
      });
    });
  });

  // Total acumulado derivativo para mostrar en el pie de página
  totalCart = computed(() => {
    return this.posModel().items.reduce((acc, item) => acc + item.sellingPrice * item.quantity, 0);
  });

  // Validador global para habilitar los flujos de cobros
  isFormValid = computed(() => {
    return this.posModel().items.length > 0 && this.posForm().valid();
  });

  registerLabel = computed(() => {
    const reg = this.currentRegister();
    if (!reg?.openedAt) return '';

    const opened = new Date(reg.openedAt);
    const now = new Date();

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const openedDay = new Date(opened.getFullYear(), opened.getMonth(), opened.getDate());

    const diffDays = Math.round((today.getTime() - openedDay.getTime()) / (1000 * 60 * 60 * 24));

    let dayLabel: string;
    if (diffDays === 0) {
      dayLabel = 'hoy';
    } else if (diffDays === 1) {
      dayLabel = 'ayer';
    } else {
      dayLabel = `${String(opened.getDate()).padStart(2, '0')}/${String(opened.getMonth() + 1).padStart(2, '0')}`;
    }

    const time = `${String(opened.getHours()).padStart(2, '0')}:${String(opened.getMinutes()).padStart(2, '0')}`;

    return `Caja abierta · ${dayLabel} ${time}`;
  });

  registerDayStatus = computed<'today' | 'yesterday' | 'old'>(() => {
    const reg = this.currentRegister();
    if (!reg?.openedAt) return 'today';

    const opened = new Date(reg.openedAt);
    const now = new Date();

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const openedDay = new Date(opened.getFullYear(), opened.getMonth(), opened.getDate());

    const diffDays = Math.round((today.getTime() - openedDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    return 'old';
  });

  async ngOnInit(): Promise<void> {
    this.scannerAvailable.set(await isBarcodeApiAvailable());
    this.checkRegister();
  }

  openScanner(): void {
    this.scanner.open();
  }

  private friendlyError(err: unknown, fallback: string): string {
    const e = err as {
      error?: { detail?: string; title?: string; message?: string };
      message?: string;
      status?: number;
    };
    return e?.error?.detail || e?.error?.title || e?.error?.message || e?.message || fallback;
  }

  checkRegister(): void {
    this.registerState.set('loading');
    this.registerError.set(null);
    this.cashRegisterService.getCurrentRegister().subscribe({
      next: (register) => {
        if (register.isOpen) {
          this.currentRegister.set(register);
          this.registerState.set('open');
        } else {
          this.registerState.set('closed');
        }
      },
      error: (err) => {
        const status = (err as { status?: number })?.status;
        const msg = this.friendlyError(err, 'No se pudo verificar la caja.');
        this.registerError.set(msg);
        this.registerState.set('error');
        if (status && status !== 404) {
          this.toast.error(msg);
        }
      },
    });
  }

  toggleOpenForm(): void {
    this.showOpenForm.update((v) => !v);
    this.openingBalance.set(0);
  }

  confirmOpenRegister(): void {
    this.cashRegisterService.openRegister({ openingBalance: this.openingBalance() }).subscribe({
      next: () => {
        this.showOpenForm.set(false);
        this.openingBalance.set(0);
        this.checkRegister();
        this.toast.success('Caja abierta');
      },
      error: (err) =>
        this.toast.error(this.friendlyError(err, 'Error al abrir la caja. Intentá de nuevo.')),
    });
  }

  openSearch(): void {
    openModal(this.router, this.route, 'search');
  }
  closeSearch(): void {
    closeModal(this.router, this.route);
  }

  /** Agrega al carrito la variante elegida en el modal de búsqueda */
  onVariantPicked(sku: string): void {
    this.onScanned(sku);
  }

  /**
   * Ejecución final del guardado de la venta en el sistema
   */
  submitSale(): void {
    if (!this.perm.can('sales', 'pos', 'create')) {
      this.toast.error('No tenés permiso para procesar ventas.');
      return;
    }
    if (!this.isFormValid()) return;

    const state = this.posModel();
    const paymentMethod = state.paymentMethod;
    if (paymentMethod === null) return;

    const dto: CreateSaleDto = {
      paymentMethod,
      invoiceNumber: null,
      documentType: 0, // Ticket
      transactionCode: state.transactionCode,
      notes: null,
      items: state.items.map((item) => ({
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        discountAmount: item.discountAmount,
      })),
    };

    this.saleService.createSale(dto).subscribe({
      next: () => {
        this.isMobilePayOpen.set(false);
        this.toast.success(`Venta procesada por Bs ${this.totalCart().toFixed(2)}`);
        this.posModel.set({
          paymentMethod: null,
          transactionCode: null,
          publicName: '',
          cashReceived: 0,
          items: [],
        });
      },
      error: (err) =>
        this.toast.error(this.friendlyError(err, 'Error al procesar la venta. Intentá de nuevo.')),
    });
  }

  /**
   * Procesa el código escaneado (SKU), busca en el backend e interactúa con el carrito
   */
  onScanned(skuValue: string): void {
    const cleanSku = skuValue.trim().toUpperCase();
    if (!cleanSku) return;

    this.productService.getVariantBySku(cleanSku).subscribe({
      next: (variant: ProductVariantBySkuDto) => {
        if (variant.availableStockInBranch <= 0) {
          this.toast.warning(`SKU ${variant.sku} sin stock en esta sucursal.`, 2500);
          return;
        }

        this.posModel.update((state) => {
          const updatedItems = [...state.items];
          const existingItemIndex = updatedItems.findIndex(
            (i) => i.productVariantId === variant.id,
          );

          if (existingItemIndex > -1) {
            const existing = updatedItems[existingItemIndex];
            if (existing.quantity < variant.availableStockInBranch) {
              updatedItems[existingItemIndex] = { ...existing, quantity: existing.quantity + 1 };
            } else {
              this.toast.warning(`Stock máximo: ${variant.availableStockInBranch} u.`, 2000);
            }
          } else {
            const newItem: PosCartItem = {
              productVariantId: variant.id,
              productName: variant.productName,
              quantity: 1,
              categoryName: variant.categoryName,
              brandName: variant.brandName,
              sku: variant.sku,
              size: variant.size,
              colorName: variant.colorName,
              stock: variant.availableStockInBranch,
              originalPrice: variant.price,
              sellingPrice: variant.price,
              discountAmount: 0,
            };
            updatedItems.unshift(newItem);
          }

          return { ...state, items: updatedItems };
        });
      },
      error: (err) => {
        if (err.status === 409) {
          this.toast.error(`Producto ${cleanSku} inactivo — no se puede vender.`);
          return;
        }
        if (err.status === 404) {
          this.toast.error(`SKU "${cleanSku}" no encontrado.`);
          return;
        }
        this.toast.error(
          this.friendlyError(err, `No se encontró producto con código: ${cleanSku}`),
        );
      },
    });
  }

  /**
   * Elimina un ítem específico del árbol por su índice
   */
  removeItem(index: number): void {
    this.posModel.update((state) => ({
      ...state,
      items: state.items.filter((_, i) => i !== index),
    }));
  }
}
