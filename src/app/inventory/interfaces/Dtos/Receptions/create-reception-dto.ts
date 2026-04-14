export default interface createReceptionDto {
   branchId: number;
   notes: string;
   items: Item[];
}

export interface Item {
   productId: number | null;
   newProduct: NewProduct | null;
   variants: Variants[];
}

export interface NewProduct {
   name: string;
   description: string;
   categoryId: number;
   brandId: number;
   basePrice: number;
   gender : number;
   unitMeasurementSin?: number;
   economicActivity?: string;
   productCodeSin?: number;
}

export interface Variants {
   productVariantId: number | null;
   newVariant: NewVariant | null;
   quantityReceived: number;
   unitCost: number;
}

export interface NewVariant {
   productId: number;
   description: string;
   size: string;
   color: string;
   price: number;
}
