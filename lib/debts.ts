import type { DebtStatementLineSnapshot, EarlyPaymentDiscountTiming, Order, Product, Receipt } from "@/types";

export type MonthlyOrderDebt = {
  order: Order;
  grossAmountBeforeQuantityDiscount: number;
  quantityDiscountAmount: number;
  dueAmount: number;
  paidAmount: number;
  receiptIds: string[];
};

export type MonthlyCustomerDebt = {
  customerId: string;
  orders: MonthlyOrderDebt[];
  grossAmountBeforeQuantityDiscount: number;
  quantityDiscountPct: number;
  quantityDiscountAmount: number;
  totalDue: number;
  totalPaid: number;
  closingBalance: number;
};

export function buildMonthlyCustomerDebts(
  periodMonth: string,
  orders: Order[],
  receipts: Receipt[],
): MonthlyCustomerDebt[] {
  const receiptsByOrder = new Map<string, Receipt[]>();

  for (const receipt of receipts) {
    if (!receipt.orderId || receipt.status === "cancelled" || receipt.status === "rejected") continue;
    const current = receiptsByOrder.get(receipt.orderId) || [];
    current.push(receipt);
    receiptsByOrder.set(receipt.orderId, current);
  }

  const byCustomer = new Map<string, MonthlyOrderDebt[]>();

  orders
    .filter(order => order.status === "active" && order.orderDate.startsWith(periodMonth))
    .sort((a, b) => a.orderDate.localeCompare(b.orderDate) || a.orderCode.localeCompare(b.orderCode))
    .forEach(order => {
      const orderReceipts = receiptsByOrder.get(order.id) || [];
      const approvedAmount = orderReceipts
        .filter(receipt => receipt.status === "approved")
        .reduce((sum, receipt) => sum + receipt.amount, 0);
      const debtAmounts = getOrderDebtAmounts(order);
      const current = byCustomer.get(order.customerId) || [];

      current.push({
        order,
        ...debtAmounts,
        paidAmount: Math.min(debtAmounts.dueAmount, approvedAmount),
        receiptIds: orderReceipts.map(receipt => receipt.id),
      });
      byCustomer.set(order.customerId, current);
    });

  return Array.from(byCustomer.entries())
    .map(([customerId, customerOrders]) => {
      const grossAmountBeforeQuantityDiscount = customerOrders.reduce(
        (sum, item) => sum + item.grossAmountBeforeQuantityDiscount,
        0,
      );
      const quantityDiscountAmount = customerOrders.reduce((sum, item) => sum + item.quantityDiscountAmount, 0);
      const quantityDiscountBase = customerOrders.reduce(
        (sum, item) => sum + Math.max(0, item.order.revenue - Number(item.order.discountSpecial || 0)),
        0,
      );
      const quantityDiscountPct = quantityDiscountBase > 0
        ? quantityDiscountAmount / quantityDiscountBase * 100
        : 0;
      const totalDue = customerOrders.reduce((sum, item) => sum + item.dueAmount, 0);
      const totalPaid = customerOrders.reduce((sum, item) => sum + item.paidAmount, 0);

      return {
        customerId,
        orders: customerOrders,
        grossAmountBeforeQuantityDiscount,
        quantityDiscountPct,
        quantityDiscountAmount,
        totalDue,
        totalPaid,
        closingBalance: Math.max(0, totalDue - totalPaid),
      };
    })
    .sort((a, b) => b.closingBalance - a.closingBalance || b.totalDue - a.totalDue);
}

export function formatPeriodMonth(periodMonth: string) {
  const [year, month] = periodMonth.split("-");
  return month && year ? `Tháng ${month}/${year}` : periodMonth;
}

export type DebtSettlement = {
  quantityDiscountPct: number;
  quantityDiscountAmount: number;
  afterQuantityDiscount: number;
  earlyPaymentDiscountPct: number;
  earlyPaymentDiscountAmount: number;
  earlyPaymentDiscountTiming: EarlyPaymentDiscountTiming;
  taxableAmount: number;
  vatPct: number;
  vatAmount: number;
  totalBeforeEarlyPaymentDiscount: number;
  totalAfterVat: number;
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

function getOrderDebtAmounts(order: Order) {
  const quantityDiscountPct = clampPercent(order.discountMonthlyPct || 0);
  const quantityDiscountBase = Math.max(0, order.revenue - Number(order.discountSpecial || 0));
  const quantityDiscountAmount = Math.round(quantityDiscountBase * quantityDiscountPct / 100);
  const grossAmountBeforeQuantityDiscount = quantityDiscountBase - Number(order.shipFee || 0);
  const dueAmount = grossAmountBeforeQuantityDiscount - quantityDiscountAmount;

  return {
    grossAmountBeforeQuantityDiscount,
    quantityDiscountAmount,
    dueAmount,
  };
}

export function calculateDebtSettlement(
  grossAmount: number,
  quantityDiscountPct: number,
  earlyPaymentDiscountPct: number,
  vatPct = 8,
  earlyPaymentDiscountTiming: EarlyPaymentDiscountTiming = "before_vat",
): DebtSettlement {
  const gross = Math.max(0, Math.round(grossAmount));
  const quantityPct = clampPercent(quantityDiscountPct);
  const earlyPct = clampPercent(earlyPaymentDiscountPct);
  const taxPct = clampPercent(vatPct);
  const quantityDiscountAmount = Math.round(gross * quantityPct / 100);
  const afterQuantityDiscount = gross - quantityDiscountAmount;
  const earlyDiscountBeforeVat = earlyPaymentDiscountTiming === "before_vat";
  const taxableAmount = earlyDiscountBeforeVat
    ? afterQuantityDiscount - Math.round(afterQuantityDiscount * earlyPct / 100)
    : afterQuantityDiscount;
  const vatAmount = Math.round(taxableAmount * taxPct / 100);
  const totalBeforeEarlyPaymentDiscount = taxableAmount + vatAmount;
  const earlyPaymentDiscountAmount = earlyDiscountBeforeVat
    ? afterQuantityDiscount - taxableAmount
    : Math.round(totalBeforeEarlyPaymentDiscount * earlyPct / 100);

  return {
    quantityDiscountPct: quantityPct,
    quantityDiscountAmount,
    afterQuantityDiscount,
    earlyPaymentDiscountPct: earlyPct,
    earlyPaymentDiscountAmount,
    earlyPaymentDiscountTiming,
    taxableAmount,
    vatPct: taxPct,
    vatAmount,
    totalBeforeEarlyPaymentDiscount,
    totalAfterVat: totalBeforeEarlyPaymentDiscount - (earlyDiscountBeforeVat ? 0 : earlyPaymentDiscountAmount),
  };
}

export function buildDebtStatementLines(
  monthlyOrders: MonthlyOrderDebt[],
  products: Product[],
  statementTotal: number,
): DebtStatementLineSnapshot[] {
  const productById = new Map(products.map(product => [product.id, product]));
  const grouped = new Map<string, DebtStatementLineSnapshot>();

  monthlyOrders.forEach(({ order }) => {
    order.items.filter(item => !item.isGift && item.lineRevenue !== 0).forEach(item => {
      const product = productById.get(item.productId);
      const key = `${item.productId}:${item.unitPrice}`;
      const current = grouped.get(key) || {
        description: product?.name || item.productId,
        unit: product?.unit || "",
        quantity: 0,
        unitPrice: item.unitPrice,
        amount: 0,
      };
      current.quantity += item.quantity;
      current.amount += item.lineRevenue;
      grouped.set(key, current);
    });
  });

  const lines = Array.from(grouped.values()).sort((a, b) => a.description.localeCompare(b.description, "vi"));
  const productTotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const adjustment = Math.round(statementTotal - productTotal);

  if (adjustment !== 0) {
    lines.push({
      description: "Điều chỉnh theo đơn hàng (phí giao hàng/chiết khấu tại đơn)",
      unit: "khoản",
      quantity: 1,
      unitPrice: adjustment,
      amount: adjustment,
    });
  }

  return lines;
}

const DIGIT_WORDS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

function readThreeDigits(value: number, forceHundreds: boolean) {
  const hundreds = Math.floor(value / 100);
  const tens = Math.floor((value % 100) / 10);
  const ones = value % 10;
  const words: string[] = [];

  if (hundreds > 0 || forceHundreds) words.push(`${DIGIT_WORDS[hundreds]} trăm`);

  if (tens > 1) {
    words.push(`${DIGIT_WORDS[tens]} mươi`);
    if (ones === 1) words.push("mốt");
    else if (ones === 5) words.push("lăm");
    else if (ones > 0) words.push(DIGIT_WORDS[ones]);
  } else if (tens === 1) {
    words.push("mười");
    if (ones === 5) words.push("lăm");
    else if (ones > 0) words.push(DIGIT_WORDS[ones]);
  } else if (ones > 0) {
    if (hundreds > 0 || forceHundreds) words.push("linh");
    words.push(DIGIT_WORDS[ones]);
  }

  return words.join(" ");
}

export function amountInVietnameseWords(amount: number) {
  const rounded = Math.round(Math.abs(amount));
  if (rounded === 0) return "Không đồng";

  const scales = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  const groups: number[] = [];
  let remaining = rounded;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const words: string[] = [];
  for (let index = groups.length - 1; index >= 0; index--) {
    const group = groups[index];
    if (group === 0) continue;
    const forceHundreds = words.length > 0 && group < 100;
    words.push(readThreeDigits(group, forceHundreds));
    if (scales[index]) words.push(scales[index]);
  }

  const result = `${amount < 0 ? "âm " : ""}${words.join(" ")} đồng chẵn`;
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export function formatVietnameseLongDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return `ngày ${date.getDate()} tháng ${date.getMonth() + 1} năm ${date.getFullYear()}`;
}
