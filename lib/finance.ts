import type { Expense, Order, Receipt } from "@/types";

export type DateRange = { from: string; to: string };

const inRange = (date: string, range: DateRange) => date >= range.from && date <= range.to;

export function receiptEffectiveDate(receipt: Receipt) {
  return (receipt.approvedAt || receipt.receiptDate || "").slice(0, 10);
}

export function isCashReceipt(receipt: Receipt) {
  return receipt.paymentMethod.trim().toLocaleLowerCase("vi").includes("cash");
}

export function summarizeFinanceRange(
  orders: Order[],
  receipts: Receipt[],
  range: DateRange,
  expenses: Expense[] = [],
) {
  const activeOrders = orders.filter(order =>
    order.status === "active" &&
    order.paymentStatus !== "tang" &&
    inRange(order.orderDate, range)
  );
  const approvedReceipts = receipts.filter(receipt =>
    receipt.status === "approved" && inRange(receiptEffectiveDate(receipt), range)
  );
  const rangeExpenses = expenses.filter(expense => inRange(expense.date, range));

  return {
    actualRevenue: approvedReceipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0),
    projectedRevenue: activeOrders.reduce((sum, order) => sum + Number(order.revenueNet || 0), 0),
    cashReceived: approvedReceipts.filter(isCashReceipt).reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0),
    bankReceived: approvedReceipts.filter(receipt => !isCashReceipt(receipt)).reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0),
    shortTermDebt: activeOrders
      .filter(order => order.paymentStatus === "chua_ck")
      .reduce((sum, order) => sum + Number(order.revenueNet || 0), 0),
    longTermDebt: activeOrders
      .filter(order => order.paymentStatus === "cong_no")
      .reduce((sum, order) => sum + Number(order.revenueNet || 0), 0),
    shipping: activeOrders.reduce((sum, order) => sum + Number(order.shipFee || 0), 0),
    shippingOrderCount: activeOrders.filter(order => Number(order.shipFee || 0) !== 0).length,
    expenses: rangeExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    expenseCount: rangeExpenses.length,
  };
}

export function summarizeFinanceDay(
  orders: Order[],
  receipts: Receipt[],
  expenses: Expense[],
  date: string,
) {
  const range = { from: date, to: date };
  return summarizeFinanceRange(orders, receipts, range, expenses);
}
