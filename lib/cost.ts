import type { OrderItem, PaymentStatus, Product, Order, ShipFeeLine } from "@/types";
import { applyDiscount } from "./discount";

// Tính 1 dòng hàng (Rule 1: hàng tặng → revenue=0, cost vẫn tính theo fix_cost)
export function calcOrderItem(item: Partial<OrderItem>, product?: Product): OrderItem {
  const quantity = Number(item.quantity ?? 0);
  const unitPrice = Number(item.unitPrice ?? 0);
  const isGift = !!item.isGift;
  const fixCostUnit = item.fixCostUnit ?? product?.fixCost ?? 0;
  const lineRevenue = isGift ? 0 : Math.round(quantity * unitPrice);
  const lineCost = Math.round(quantity * fixCostUnit);
  return {
    id: item.id ?? "",
    productId: item.productId ?? "",
    quantity, unitPrice, isGift, fixCostUnit, lineRevenue, lineCost,
  };
}

export interface OrderCalc {
  revenue: number;
  revenueNet: number;
  cost: number;
  saleCommission: number;
  profitNet: number;
  breakdown: ReturnType<typeof applyDiscount>;
}

export function calcOrder(opts: {
  items: OrderItem[];
  shipFee: number;
  discountSpecial: number;
  discountMonthlyPct: number;
  discountEarlyPayPct: number;
  saleCommissionPct: number;
}): OrderCalc {
  const revenue = opts.items.reduce((s, i) => s + i.lineRevenue, 0);
  const cost = opts.items.reduce((s, i) => s + i.lineCost, 0);
  const breakdown = applyDiscount({
    subtotal: revenue,
    discountSpecial: opts.discountSpecial,
    discountMonthlyPct: opts.discountMonthlyPct,
    discountEarlyPayPct: opts.discountEarlyPayPct,
    shipFee: opts.shipFee,
  });
  const revenueNet = breakdown.revenueNet;
  const saleCommission = Math.round(revenueNet * Number(opts.saleCommissionPct || 0) / 100);
  const profitNet = revenueNet - cost - saleCommission; // Rule 3
  return { revenue, revenueNet, cost, saleCommission, profitNet, breakdown };
}

// Đơn tặng = mọi dòng đều là hàng tặng → không thu tiền, hoàn thành ngay, không có phiếu thu.
export const isGiftOrder = (order: Pick<Order, "items">) =>
  order.items.length > 0 && order.items.every(item => item.isGift);

// Đơn bù hàng: không tính tiền nhưng vẫn trừ tồn kho
export const isCompensationOrder = (order: Pick<Order, "paymentStatus">) => order.paymentStatus === "bu_hang";

// Đơn không thu tiền (tặng hoặc bù hàng) → không phiếu thu, không công nợ, không doanh thu
export const isFreeOrder = (order: Pick<Order, "items" | "paymentStatus">) =>
  isGiftOrder(order) || isCompensationOrder(order);

// Dòng hàng của đơn bù: giữ đơn giá để tham chiếu nhưng doanh thu dòng = 0
export const zeroRevenueItems = (items: OrderItem[]): OrderItem[] =>
  items.map(item => (item.lineRevenue === 0 ? item : { ...item, lineRevenue: 0 }));

// Trạng thái thanh toán để hiển thị / tính toán. Đơn tặng tạo trước khi có quy tắc này
// vẫn lưu "chua_ck" nên phải suy ra từ dòng hàng thay vì đọc trực tiếp.
export const effectivePaymentStatus = (order: Order): PaymentStatus =>
  isCompensationOrder(order) ? "bu_hang" : isGiftOrder(order) ? "tang" : order.paymentStatus;

// Dòng phí ship của đơn (đơn cũ chỉ có shipFee → 1 dòng, không đánh dấu công ty thanh toán)
export const shipLinesOf = (order: Pick<Order, "shipFee" | "shipFees">): ShipFeeLine[] =>
  order.shipFees?.length ? order.shipFees : [{ amount: Number(order.shipFee || 0), companyPaid: false }];

export const sumShipLines = (lines: ShipFeeLine[]) =>
  lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);

// Phần phí ship công ty thanh toán qua tài khoản ngân hàng
export const companyPaidShipOf = (order: Pick<Order, "shipFee" | "shipFees">) =>
  sumShipLines(shipLinesOf(order).filter(line => line.companyPaid));

// Đơn cancelled không tính vào dashboard / lương (Rule 4)
export const isActiveOrder = (o: Order) => o.status === "active";
