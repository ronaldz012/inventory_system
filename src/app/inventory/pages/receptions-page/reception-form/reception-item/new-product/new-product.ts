import { Component, DestroyRef, inject, input, output, ViewChild, ElementRef } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NewProductFormGroup } from '../../common/item-form-group';
import { Category } from '../../../../../interfaces/Dtos/category-dto';
import { Brand } from '../../../../../interfaces/Dtos/brand-dto';
import { SelectFromList } from '../../../../../../core/select-from-list/select-from-list';
import { CreateEntityEvent } from '../../../../../interfaces/types/create-entity-event';

@Component({
  selector: 'app-new-product',
  standalone: true,
  imports: [ReactiveFormsModule, SelectFromList],
  templateUrl: './new-product.html',
  styles: [`:host { display: contents; }`],
})
export default class NewProduct {
  // Referencia al input de marca
  @ViewChild('brandInput') brandInput!: ElementRef<HTMLInputElement>;

  form = input.required<NewProductFormGroup>();
  categories = input.required<Category[]>();
  brands = input.required<Brand[]>();
  index = input.required<number>();

  switchMode = output<void>();
  remove = output<void>();
  openCreation = output<CreateEntityEvent>();

  readonly genderOptions = [
    { label: 'Unisex', value: 0 },
    { label: 'Hombre', value: 1 },
    { label: 'Mujer', value: 2 }
  ];

  onCategorySelected(category: Category | null) {
    this.form().patchValue({ categoryId: category?.id ?? null });
  }

  // 🔥 Nueva función para mover el foco
  focusBrand() {
    setTimeout(() => {
      this.brandInput.nativeElement.focus();
    }, 10);
  }

  onBrandChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (value === '+ CREAR NUEVA MARCA') return;
    const brand = this.brands().find(b => b.name.toLowerCase() === value.toLowerCase());
    this.form().patchValue({ brandId: brand?.id ?? null });
  }

  handleCreateCategory(text: string) {
    this.openCreation.emit({ type: 'category', query: text, itemIndex: this.index() });
  }
}
