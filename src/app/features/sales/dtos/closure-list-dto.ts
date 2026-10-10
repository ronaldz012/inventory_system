export interface ClosureListDto {
  id: GUID;
  number: number;
  openedAt: string;
  closedAt: string | null;
  openedByName: string;
  closedByName: string | null;
  openingBalance: number;
  totalSales: number;
  cashSales: number;
  totalExpenses: number;
  systemSalesAmount: number;
  realCountedAmount: number;
  difference: number;
}
