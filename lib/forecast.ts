import type { Order, CustomerBranch } from "@/types";
import { addDays, daysBetween, todayISO } from "./utils";

// Dự báo ngày order tiếp theo của 1 chi nhánh (Rule 5 — mục 8.1.6 / 8.2.4)
// est_next = order_date gần nhất + AVG(khoảng cách giữa các đơn 3 tháng gần nhất)
export function recalcBranchForecast(branchId: string, allOrders: Order[]): Partial<CustomerBranch> {
  const cutoff = addDays(todayISO(), -90);
  const orders = allOrders
    .filter(o => o.branchId === branchId && o.status === "active")
    .sort((a, b) => a.orderDate.localeCompare(b.orderDate));
  if (orders.length === 0) return {};
  const lastOrderDate = orders[orders.length - 1].orderDate;

  const recent = orders.filter(o => o.orderDate >= cutoff);
  const basis = recent.length >= 2 ? recent : orders;
  let avgGap = 0;
  if (basis.length >= 2) {
    let sum = 0;
    for (let i = 1; i < basis.length; i++) sum += daysBetween(basis[i - 1].orderDate, basis[i].orderDate);
    avgGap = Math.round(sum / (basis.length - 1));
  }
  const estNextOrderDate = avgGap > 0 ? addDays(lastOrderDate, avgGap) : undefined;
  return { lastOrderDate, avgOrderGapDays: avgGap || undefined, estNextOrderDate };
}

// Khách "sắp/đã hết hàng" = hôm nay > est_next_order_date
export function isBranchDue(branch: CustomerBranch, today = todayISO()): boolean {
  if (!branch.estNextOrderDate) return false;
  return today > branch.estNextOrderDate;
}
