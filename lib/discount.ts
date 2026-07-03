// Chiết khấu 3 lớp tuần tự (Rule 2 — mục 8.2.4 / 12.2)
// B1: subtotal = SUM(line_revenue)
// B2: after_special = subtotal - discount_special
// B3: after_monthly = after_special × (1 - monthly%/100)
// B4: after_early   = after_monthly × (1 - early%/100)
// B5: revenue_net   = after_early - ship_fee   (ship có thể âm)

export interface DiscountInput {
  subtotal: number;
  discountSpecial: number;
  discountMonthlyPct: number;
  discountEarlyPayPct: number;
  shipFee: number;
}

export interface DiscountBreakdown {
  subtotal: number;
  afterSpecial: number;
  afterMonthly: number;
  afterEarly: number;
  revenueNet: number;
}

export function applyDiscount(input: DiscountInput): DiscountBreakdown {
  const subtotal = Number(input.subtotal || 0);
  const afterSpecial = subtotal - Number(input.discountSpecial || 0);
  const afterMonthly = afterSpecial * (1 - Number(input.discountMonthlyPct || 0) / 100);
  const afterEarly = afterMonthly * (1 - Number(input.discountEarlyPayPct || 0) / 100);
  const revenueNet = Math.round(afterEarly - Number(input.shipFee || 0));
  return {
    subtotal: Math.round(subtotal),
    afterSpecial: Math.round(afterSpecial),
    afterMonthly: Math.round(afterMonthly),
    afterEarly: Math.round(afterEarly),
    revenueNet,
  };
}
