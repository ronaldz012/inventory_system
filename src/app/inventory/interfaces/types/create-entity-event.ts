export type CreateEntityEvent = {
  type: 'category' | 'brand';
  query: string;
  itemIndex: number;
};
