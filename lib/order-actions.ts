import type { Order, OrderItem, Receipt, ReceiptStatus, PaymentStatus, Profile } from "@/types";
import type { State } from "./store";
import { calcOrder } from "./cost";
import { recalcBranchForecast } from "./forecast";
import { nextSequentialCode, newId, todayISO } from "./utils";

// Sinh phiếu thu theo payment_status (Rule 6 — mục 8.2.4)
function receiptStatusFor(payment: PaymentStatus): ReceiptStatus | null {
  switch (payment) {
    case "cash_done": return "approved";       // mặc định Admin đã thu tiền mặt
    case "da_ck": return "waiting_admin";       // chờ Admin xác nhận tiền về
    case "chua_ck":
    case "cong_no": return "pending";
    case "tang": return null;                   // hàng tặng → không sinh phiếu thu
    default: return "pending";
  }
}

export interface NewOrderInput {
  orderDate: string;
  customerId: string;
  branchId: string;
  saleId: string;
  items: OrderItem[];
  shipFee: number;
  discountSpecial: number;
  discountMonthlyPct: number;
  discountEarlyPayPct: number;
  saleCommissionPct: number;
  paymentStatus: PaymentStatus;
  note?: string;
}

// Tạo đơn → trả về State mới (insert order + receipt, update forecast, trừ cl_inventory)
export function createOrder(state: State, input: NewOrderInput, actor: Profile): State {
  const calc = calcOrder(input);
  const orderId = newId();
  const order: Order = {
    id: orderId,
    orderCode: nextSequentialCode("DH", state.orders.map(o => o.orderCode)),
    createdAt: new Date().toISOString(),
    orderDate: input.orderDate,
    customerId: input.customerId,
    branchId: input.branchId,
    saleId: input.saleId,
    items: input.items.map(i => ({ ...i, id: i.id || newId() })),
    shipFee: input.shipFee,
    discountSpecial: input.discountSpecial,
    discountMonthlyPct: input.discountMonthlyPct,
    discountEarlyPayPct: input.discountEarlyPayPct,
    revenue: calc.revenue,
    revenueNet: calc.revenueNet,
    cost: calc.cost,
    saleCommissionPct: input.saleCommissionPct,
    saleCommission: calc.saleCommission,
    profitNet: calc.profitNet,
    paymentStatus: input.paymentStatus,
    status: "active",
    note: input.note,
  };

  const orders = [order, ...state.orders];

  // Phiếu thu
  let receipts = state.receipts;
  const rStatus = receiptStatusFor(input.paymentStatus);
  if (rStatus) {
    const receipt: Receipt = {
      id: newId(),
      receiptCode: nextSequentialCode("PT", state.receipts.map(r => r.receiptCode)),
      orderId,
      customerId: input.customerId,
      amount: calc.revenueNet,
      paymentMethod: input.paymentStatus === "cash_done" ? "cash" : "chuyển khoản",
      receiptDate: input.orderDate,
      status: rStatus,
      approvedBy: rStatus === "approved" ? (actor.role === "admin" ? actor.id : "u_admin") : undefined,
      approvedAt: rStatus === "approved" ? todayISO() : undefined,
    };
    receipts = [receipt, ...receipts];
  }

  // Cập nhật dự báo chi nhánh
  const forecast = recalcBranchForecast(input.branchId, orders);
  const branches = state.branches.map(b => b.id === input.branchId ? { ...b, ...forecast } : b);

  // Trừ tồn kho CL (Hà Nội) — cả hàng tặng (Rule 8 mục 12.8)
  const clInventory = state.clInventory.map(ci => {
    const used = input.items.filter(i => i.productId === ci.productId).reduce((s, i) => s + i.quantity, 0);
    return used ? { ...ci, qtyKg: +(ci.qtyKg - used).toFixed(2) } : ci;
  });

  return { ...state, orders, receipts, branches, clInventory };
}
