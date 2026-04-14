import {Component, ElementRef, inject, input, OnInit, output, ViewChild} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {Brand} from '../../interfaces/Dtos/brand-dto';
import {BrandService} from '../../services/brand-service';


@Component({
  selector: 'app-create-brand',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './create-brand.html',
  styles: ``,
})
export class CreateBrand implements OnInit {
  @ViewChild('nameInput') nameInput!: ElementRef<HTMLInputElement>;
  private fb = inject(FormBuilder);
  initialName = input.required<string>();
  brandService = inject(BrandService);
  created = output<Brand>();
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
    this.brandService.create({name: body.name!, description: body.description!}).subscribe(
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
