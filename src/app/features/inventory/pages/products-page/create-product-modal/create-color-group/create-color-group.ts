import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FieldTree, FormField, form } from '@angular/forms/signals';
import { ColorGroupForm } from '@features/inventory/models/color-group-form.model';
import { ColorSelectCtrl } from '@features/inventory/components/color-select-ctrl/color-select-ctrl.component';
import { SizeSelectCtrl } from '@features/inventory/components/size-select-ctrl/size-select-ctrl.component';
import { Size } from '@features/inventory/dtos/sizes/size';
import { blockNonNumericKeys } from '@shared/utils/list-query';

/**
 * Tarjeta de creación: un color y sus tallas.
 *
 * El color se elige una sola vez por tarjeta; cada fila de talla conserva su
 * propio precio, editable de forma individual o con el precio masivo.
 * El selector de talla es un combo con búsqueda y creación inline, igual que
 * el de color; las tallas ya agregadas se excluyen de la lista.
 */
@Component({
  selector: 'app-create-color-group',
  imports: [FormField, ColorSelectCtrl, SizeSelectCtrl],
  templateUrl: './create-color-group.html',
})
export default class CreateColorGroup {
  /** El template no puede llamar imports: se expone el helper tal cual. */
  readonly blockKeys = blockNonNumericKeys;

  formModel = input.required<FieldTree<ColorGroupForm>>();
  /** Valor del grupo (lectura para contadores). */
  group = input.required<ColorGroupForm>();
  index = input.required<number>();
  /** Catálogo de tallas activas, ya ordenado por sortOrder. */
  sizes = input.required<Size[]>();
  /** Colores usados en otras tarjetas: no se ofrecen de nuevo. */
  excludedColorIds = input<GUID[]>([]);

  remove = output<void>();
  duplicate = output<void>();
  addSize = output<Size>();
  removeSize = output<number>();

  private readonly injector = inject(Injector);
  private readonly addSizeAnchor = viewChild<ElementRef<HTMLElement>>('addSizeAnchor');

  /** Borrador del combo "Agregar talla": no forma parte del producto. */
  pickerModel = signal<{ sizeId: GUID; sizeName: string }>({
    sizeId: '' as GUID,
    sizeName: '',
  });
  pickerForm = form(this.pickerModel);

  /** Tallas que ya están en esta tarjeta: no se ofrecen de nuevo. */
  usedSizeIds = computed(() => this.group().sizes.map((size) => size.sizeId));

  constructor() {
    // El combo confirma una talla (elegida o recién creada): se agrega al
    // grupo, se limpia el borrador y se asegura que la fila nueva quede a la
    // vista junto con el combo para seguir cargando.
    effect(() => {
      const sizeId = this.pickerModel().sizeId;
      if (!sizeId) return;
      const size = this.sizes().find((s) => s.id === sizeId);
      untracked(() => {
        if (size) this.addSize.emit(size);
        this.pickerModel.set({ sizeId: '' as GUID, sizeName: '' });
        afterNextRender(
          () =>
            this.addSizeAnchor()?.nativeElement.scrollIntoView?.({
              block: 'nearest',
              behavior: 'smooth',
            }),
          { injector: this.injector },
        );
      });
    });
  }

  onRemoveSize(index: number): void {
    this.removeSize.emit(index);
  }
}
