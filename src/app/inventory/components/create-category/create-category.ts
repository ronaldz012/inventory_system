import {Component, ElementRef, inject, input, OnInit, output, signal, ViewChild} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {CategoryService} from '../../services/category-service';
import {Category} from '../../dtos/categories/category-dto';

@Component({
  selector: 'app-create-category',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './create-category.html',
  styles: ``,
})
export class CreateCategory  implements OnInit {

  @ViewChild('nameInput') nameInput!: ElementRef<HTMLInputElement>;
  private fb = inject(FormBuilder);
  categoryService = inject(CategoryService);
  initialName = input.required<string>();
  created = output<Category>();
  closed  = output<void>();

  form = this.fb.group({
    name:        ['', [Validators.required, Validators.minLength(2)]],
    description: ['']
  });

  ngOnInit(): void {
    this.form.controls.name.setValue(this.initialName())
  }
  focus() {
    this.nameInput?.nativeElement.focus();
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const body = this.form.getRawValue()
    this.categoryService.create({name: body.name!, description: body.description!}).subscribe(
      data => {
        this.created.emit(data);
      }
    )
    this.form.reset();
  }

  get nameInvalid() {
    const ctrl = this.form.get('name')!;
    return ctrl.invalid && ctrl.touched;
  }
}
