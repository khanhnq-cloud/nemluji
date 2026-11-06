import type { State } from "./store";
import type { Expense, ExpensePaymentMethod, Profile, StockPurchase } from "@/types";
import { adjustInventory, invQty } from "./inventory";
import { newId, nextSequentialCode } from "./utils";

export interface NewStockPurchase {
  purchaseDate: string;
  productId: string;
  qty: number;
  unitPrice: number;
  paymentMethod: ExpensePaymentMethod;
  supplier?: string;
  note?: string;
}

// Hàng mua ngoài (không do xưởng sản xuất) → nhập thẳng Kho Cát Linh
export const purchasableProducts = (state: State) =>
  state.products.filter(p => p.isActive && !p.isFactoryOutput);

// Tạo phiếu nhập: cộng tồn Cát Linh + sinh phiếu chi (vào Tổng chi phí)
export function createStockPurchase(state: State, input: NewStockPurchase, actor: Profile): State {
  const product = state.products.find(p => p.id === input.productId);
  if (!product || !(input.qty > 0) || !(input.unitPrice > 0)) return state;

  const id = newId();
  const expenseId = newId();
  const qty = +input.qty.toFixed(2);
  const totalCost = Math.round(qty * input.unitPrice);
  const supplier = input.supplier?.trim() || undefined;
  const code = nextSequentialCode("NH", state.stockPurchases.map(p => p.code));
  const createdAt = new Date().toISOString();

  const purchase: StockPurchase = {
    id, code, purchaseDate: input.purchaseDate, productId: product.id, qty,
    unitPrice: input.unitPrice, totalCost, paymentMethod: input.paymentMethod, supplier,
    note: input.note?.trim() || undefined, status: "active", expenseId, createdBy: actor.id, createdAt,
  };
  const expense: Expense = {
    id: expenseId, code: nextSequentialCode("PC", state.expenses.map(e => e.code)), date: input.purchaseDate,
    type: "stock_purchase", amount: totalCost, paymentMethod: input.paymentMethod, payee: supplier, refId: id,
    note: `Nhập ${qty} ${product.unit} ${product.name} — ${code}`, createdBy: actor.id, createdAt,
  };
  return {
    ...state,
    stockPurchases: [purchase, ...state.stockPurchases],
    expenses: [expense, ...state.expenses],
    clInventory: adjustInventory(state.clInventory, product.id, qty),
  };
}

// Còn đủ tồn để huỷ? (hàng đã bán hết thì không rút lại được)
export function canCancelStockPurchase(state: State, purchase: StockPurchase): boolean {
  return purchase.status === "active" && invQty(state.clInventory, purchase.productId) >= purchase.qty - 1e-9;
}

// Huỷ phiếu nhập: trừ lại tồn + huỷ phiếu chi đi kèm
export function cancelStockPurchase(state: State, id: string, reason: string): State {
  const purchase = state.stockPurchases.find(p => p.id === id);
  if (!purchase || !canCancelStockPurchase(state, purchase)) return state;
  return {
    ...state,
    stockPurchases: state.stockPurchases.map(p => p.id === id ? { ...p, status: "cancelled" as const, cancelReason: reason } : p),
    expenses: state.expenses.filter(e => e.id !== purchase.expenseId),
    clInventory: adjustInventory(state.clInventory, purchase.productId, -purchase.qty),
  };
}
