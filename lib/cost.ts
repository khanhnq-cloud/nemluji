import type { OrderItem, Product, Order } from "@/types";
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

// Đơn cancelled không tính vào dashboard / lương (Rule 4)
export const isActiveOrder = (o: Order) => o.status === "active";
