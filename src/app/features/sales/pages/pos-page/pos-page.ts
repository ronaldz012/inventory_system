import { Component, OnDestroy, OnInit, ViewChild, signal, inject, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ModalStackService, useStackedModal } from '@core/modal-stack-service';
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
import { MoneyPipe } from '@shared/pipes/money-pipe';
import { PosMobilePayModal } from './pos-mobile-pay-modal/pos-mobile-pay-modal';
import { PosDesktopPayPanel } from './pos-desktop-pay-panel/pos-desktop-pay-panel';
import { PosSearchModal } from './pos-search-modal/pos-search-modal';
import { PosFreeItemModal, FreeItemDraft } from './pos-free-item-modal/pos-free-item-modal';
import { CashRegisterService } from '@features/sales/services/cash-register-service';
import { CurrentRegisterDto } from '@features/sales/dtos/current-register-dto';
import { SaleService } from '@features/sales/services/sale-service';
import { CreateSaleDto } from '@features/sales/dtos/create-sale-dto';
import { ToastService } from '@core/services/toast-service';
import { PermissionService } from '@features/auth/services/permmision-service';
import CreateExpenseModal from '@features/sales/pages/expenses-page/create-expense-modal';

@Component({
  selector: 'app-pos-page',
  standalone: true,
  imports: [
    RouterLink,
    SkuInput,
    QrScannerModal,
    PosCartItemCardComponent,
    MoneyPipe,
    PosMobilePayModal,
    PosDesktopPayPanel,
    PosSearchModal,
    PosFreeItemModal,
    CreateExpenseModal,
  ],
  templateUrl: './pos-page.html',
})
export default class PosPage implements OnInit, OnDestroy {
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
  private stack = inject(ModalStackService);

  // ── POS state ──────────────────────────────────────────────────────────

  @ViewChild(QrScannerModal) scanner!: QrScannerModal;
  private productService = inject(ProductService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  scannerAvailable = signal(false);

  /** Sheet de cobro (mobile). Registrado en la pila: atrás lo oculta vía modalGuard. */
  isMobilePayOpen = signal(false);
  submitting = signal(false);
  payModal = useStackedModal(this.stack, this.isMobilePayOpen);

  /** Buscador de productos: señal + pila de modales (igual que el resto del POS). */
  searchOpen = signal(false);
  searchModal = useStackedModal(this.stack, this.searchOpen);

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

      // Control reactivo de stock por prenda en el carrito.
      // Los ítems libres (stock null) no descuentan inventario: sin tope.
      validate(item.quantity, ({ value, valueOf }) => {
        const stock = valueOf(item.stock);
        if (stock == null) return null;
        if (value() > stock) {
          return { kind: 'outOfStock', message: 'Supera el stock.' };
        }
        return null;
      });

      // Venta libre: el backend exige unitPrice >= 0.5. El precio también se
      // edita desde el carrito, así que el mínimo se valida acá.
      validate(item.sellingPrice, ({ value, valueOf }) => {
        if (!valueOf(item.isFree)) return null;
        return value() < 0.5 ? { kind: 'minPrice', message: 'Mínimo Bs 0.50.' } : null;
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
    this.searchModal.open();
  }
  closeSearch(): void {
    this.searchModal.close();
  }

  /** "Gastos" ahora registra el gasto sobre el POS, sin saltear de pantalla. */
  showCreateExpense = signal(false);
  expenseModal = useStackedModal(this.stack, this.showCreateExpense);

  /** Venta libre: ítem sin producto registrado (solo descripción, cantidad y precio). */
  isFreeItemOpen = signal(false);
  freeItemModal = useStackedModal(this.stack, this.isFreeItemOpen);

  ngOnDestroy(): void {
    this.payModal.destroy();
    this.expenseModal.destroy();
    this.freeItemModal.destroy();
    this.searchModal.destroy();
  }

  /** Agrega al carrito la variante elegida en el modal de búsqueda */
  onVariantPicked(sku: string): void {
    this.onScanned(sku);
  }

  /**
   * Ejecución final del guardado de la venta en el sistema
   */
  submitSale(): void {
    if (this.submitting()) return;

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
      items: state.items.map((item) => {
        // Venta libre: se envía descripción + precio, nunca productVariantId.
        if (item.isFree) {
          const basePrice = item.originalPrice;
          const unitPrice = Math.max(basePrice, item.sellingPrice);
          return {
            description: item.description ?? '',
            unitPrice,
            quantity: item.quantity,
            discountAmount: Math.max(0, basePrice - item.sellingPrice),
          };
        }

        return {
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          discountAmount: item.discountAmount,
        };
      }),
    };

    this.submitting.set(true);
    this.saleService.createSale(dto).subscribe({
      next: () => {
        this.submitting.set(false);
        this.payModal.close();
        this.toast.success(`Venta procesada por Bs ${this.totalCart().toFixed(2)}`);
        this.posModel.set({
          paymentMethod: null,
          transactionCode: null,
          publicName: '',
          cashReceived: 0,
          items: [],
        });
      },
      error: (err) => {
        this.submitting.set(false);
        this.toast.error(this.friendlyError(err, 'Error al procesar la venta. Intentá de nuevo.'));
      },
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
              isFree: false,
              description: null,
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
   * Agrega al carrito un ítem libre (venta sin producto registrado).
   * Se trata como cualquier otra línea: precio, cantidad y descuento editables.
   */
  onFreeItemSaved(draft: FreeItemDraft): void {
    const newItem: PosCartItem = {
      productVariantId: null,
      quantity: Math.max(1, Math.trunc(draft.quantity)),
      productName: '',
      categoryName: '',
      brandName: '',
      sku: '',
      size: '',
      colorName: '',
      stock: null,
      originalPrice: draft.unitPrice,
      sellingPrice: draft.unitPrice,
      discountAmount: 0,
      isFree: true,
      description: draft.description,
    };

    this.posModel.update((state) => ({ ...state, items: [newItem, ...state.items] }));
    this.freeItemModal.close();
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
