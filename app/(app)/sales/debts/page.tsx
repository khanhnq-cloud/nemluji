"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import { StatusBadge } from "@/components/Badge";
import DebtDocumentViewer from "@/components/debts/DebtDocumentViewer";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import {
  buildDebtStatementLines,
  buildMonthlyCustomerDebts,
  calculateDebtSettlement,
  formatPeriodMonth,
  type MonthlyCustomerDebt,
} from "@/lib/debts";
import {
  formatMoney,
  formatNumber,
  monthISO,
  newId,
  nextSequentialCode,
} from "@/lib/utils";
import {
  CalendarRange,
  Eye,
  FileCheck2,
  FileText,
  Lock,
  Percent,
} from "lucide-react";
import type { DebtStatement, EarlyPaymentDiscountTiming } from "@/types";

const VAT_PCT = 8;

type DiscountDraft = {
  earlyPaymentDiscountPct: number;
  earlyPaymentDiscountTiming: EarlyPaymentDiscountTiming;
};

export default function DebtsPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const [period, setPeriod] = useState(monthISO());
  const [viewStatementId, setViewStatementId] = useState<string | null>(null);
  const [closingCustomerIds, setClosingCustomerIds] = useState<string[]>([]);
  const [discountDrafts, setDiscountDrafts] = useState<Record<string, DiscountDraft>>({});
  const [notice, setNotice] = useState("");

  const monthlyDebts = useMemo(
    () => buildMonthlyCustomerDebts(period, state.orders, state.receipts),
    [period, state.orders, state.receipts],
  );

  const statementByCustomer = useMemo(() => {
    const map = new Map<string, DebtStatement>();
    state.debtStatements
      .filter(statement => statement.periodMonth === period)
      .forEach(statement => map.set(statement.customerId, statement));
    return map;
  }, [period, state.debtStatements]);

  const unclosedDebts = monthlyDebts.filter(debt => !statementByCustomer.has(debt.customerId));
  const closingDebts = monthlyDebts.filter(debt => closingCustomerIds.includes(debt.customerId));
  const selectedStatement = state.debtStatements.find(statement => statement.id === viewStatementId) || null;
  const orderCount = monthlyDebts.reduce((sum, debt) => sum + debt.orders.length, 0);
  const totalDue = monthlyDebts.reduce((sum, debt) => sum + debt.totalDue, 0);
  const totalPaid = monthlyDebts.reduce((sum, debt) => sum + debt.totalPaid, 0);
  const totalOutstanding = monthlyDebts.reduce((sum, debt) =>
    sum + (statementByCustomer.get(debt.customerId)?.closingBalance ?? debt.closingBalance), 0);

  const openClosing = (debts: MonthlyCustomerDebt[]) => {
    const eligible = debts.filter(debt => !statementByCustomer.has(debt.customerId));
    if (eligible.length === 0) {
      setNotice(`Tất cả khách hàng trong ${formatPeriodMonth(period).toLowerCase()} đã được chốt.`);
      return;
    }

    setDiscountDrafts(Object.fromEntries(eligible.map(debt => [debt.customerId, {
      earlyPaymentDiscountPct: state.settings.defaultEarlyPayPct || 0,
      earlyPaymentDiscountTiming: "before_vat",
    }])));
    setClosingCustomerIds(eligible.map(debt => debt.customerId));
    setNotice("");
  };

  const updateDiscount = (customerId: string, patch: Partial<DiscountDraft>) => {
    setDiscountDrafts(current => ({
      ...current,
      [customerId]: { ...current[customerId], ...patch },
    }));
  };

  const issueStatements = () => {
    const closedKeys = new Set(state.debtStatements.map(statement => `${statement.periodMonth}:${statement.customerId}`));
    const eligible = closingDebts.filter(debt => !closedKeys.has(`${period}:${debt.customerId}`));
    if (eligible.length === 0) {
      setClosingCustomerIds([]);
      setNotice("Các khách hàng đã được chốt trong một thao tác khác.");
      return;
    }

    const allocatedCodes = state.debtStatements.map(statement => statement.code);
    const createdAt = new Date().toISOString();
    const newStatements = eligible.map(debt => {
      const draft = discountDrafts[debt.customerId] || {
        earlyPaymentDiscountPct: 0,
        earlyPaymentDiscountTiming: "before_vat" as const,
      };
      const settlement = calculateDebtSettlement(
        debt.totalDue,
        0,
        draft.earlyPaymentDiscountPct,
        VAT_PCT,
        draft.earlyPaymentDiscountTiming,
      );
      const code = nextSequentialCode("CN", allocatedCodes);
      allocatedCodes.push(code);

      const statement: DebtStatement = {
        id: newId(),
        code,
        customerId: debt.customerId,
        periodMonth: period,
        openingBalance: 0,
        totalDue: debt.totalDue,
        totalPaid: debt.totalPaid,
        closingBalance: Math.max(0, settlement.totalAfterVat - debt.totalPaid),
        status: "closed",
        receiptIds: Array.from(new Set(debt.orders.flatMap(item => item.receiptIds))),
        orderIds: debt.orders.map(item => item.order.id),
        orderSnapshots: debt.orders.map(item => ({
          orderId: item.order.id,
          orderCode: item.order.orderCode,
          orderDate: item.order.orderDate,
          branchId: item.order.branchId,
          amount: item.dueAmount,
          paidAmount: item.paidAmount,
          grossAmount: item.grossAmountBeforeQuantityDiscount,
          quantityDiscountPct: item.order.discountMonthlyPct || 0,
          quantityDiscountAmount: item.quantityDiscountAmount,
        })),
        lineSnapshots: buildDebtStatementLines(debt.orders, state.products, debt.grossAmountBeforeQuantityDiscount),
        grossAmountBeforeQuantityDiscount: debt.grossAmountBeforeQuantityDiscount,
        quantityDiscountAppliedAtOrder: true,
        quantityDiscountPct: debt.quantityDiscountPct,
        quantityDiscountAmount: debt.quantityDiscountAmount,
        earlyPaymentDiscountPct: settlement.earlyPaymentDiscountPct,
        earlyPaymentDiscountAmount: settlement.earlyPaymentDiscountAmount,
        earlyPaymentDiscountTiming: settlement.earlyPaymentDiscountTiming,
        taxableAmount: settlement.taxableAmount,
        vatPct: settlement.vatPct,
        vatAmount: settlement.vatAmount,
        totalBeforeEarlyPaymentDiscount: settlement.totalBeforeEarlyPaymentDiscount,
        totalAfterVat: settlement.totalAfterVat,
        createdAt,
      };

      return statement;
    });

    const statementIdByReceipt = new Map<string, string>();
    newStatements.forEach(statement => {
      statement.receiptIds.forEach(receiptId => statementIdByReceipt.set(receiptId, statement.id));
    });

    update(current => ({
      ...current,
      debtStatements: [...newStatements, ...current.debtStatements],
      receipts: current.receipts.map(receipt => {
        const debtStatementId = statementIdByReceipt.get(receipt.id);
        return debtStatementId ? { ...receipt, debtStatementId } : receipt;
      }),
    }));

    setClosingCustomerIds([]);
    setDiscountDrafts({});
    setNotice(`Đã chốt ${newStatements.length} khách hàng và phát hành đầy đủ hai chứng từ.`);
    if (newStatements.length === 1) setViewStatementId(newStatements[0].id);
  };

  const statements = useMemo(
    () => [...state.debtStatements].sort((a, b) =>
      b.periodMonth.localeCompare(a.periodMonth) ||
      (b.createdAt || "").localeCompare(a.createdAt || "") ||
      b.code.localeCompare(a.code),
    ),
    [state.debtStatements],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Công nợ theo tháng"
        subtitle="Tổng hợp chiết khấu số lượng từ đơn hàng, chọn cách tính chiết khấu thanh toán sớm khi chốt"
        actions={
          <>
            <input
              type="month"
              className="input w-44"
              value={period}
              onChange={event => { setPeriod(event.target.value); setNotice(""); }}
              aria-label="Tháng chốt công nợ"
            />
            <button className="btn-primary" onClick={() => openClosing(unclosedDebts)} disabled={unclosedDebts.length === 0}>
              <Lock className="h-4 w-4" />
              Chốt {unclosedDebts.length || "toàn bộ"} khách
            </button>
          </>
        }
      />

      {notice && (
        <div className="px-3 py-2 border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-md text-sm">
          {notice}
        </div>
      )}

      <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
        <CalendarRange className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>
          Chiết khấu số lượng đã được áp dụng trên từng đơn hàng. Khi chốt, có thể chọn chiết khấu thanh toán sớm trước hoặc sau VAT {VAT_PCT}%.
          Mỗi khách có một phiếu đề nghị thanh toán và một biên bản đối chiếu công nợ.
        </span>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Giá trị đơn trong tháng" value={formatMoney(totalDue)} hint={`${orderCount} đơn hàng`} />
        <StatCard label="Khách phát sinh đơn" value={monthlyDebts.length} hint={`${monthlyDebts.length - unclosedDebts.length} khách đã chốt`} />
        <StatCard label="Đã thanh toán" value={formatMoney(totalPaid)} tone="good" />
        <StatCard label="Công nợ hiện tại" value={formatMoney(totalOutstanding)} tone={totalOutstanding ? "warn" : "good"} />
      </div>

      <section className="card overflow-hidden">
        <div className="px-3 py-2 border-b flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-sm">Tổng hợp {formatPeriodMonth(period).toLowerCase()}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Giá trị đơn đã gồm chiết khấu số lượng tại thời điểm tạo đơn và chưa gồm VAT.</p>
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">{monthlyDebts.length - unclosedDebts.length}/{monthlyDebts.length} đã chốt</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>Sale phụ trách</th>
                <th className="text-right">Số đơn</th>
                <th className="text-right">Giá trị đơn</th>
                <th className="text-right">Đã thanh toán</th>
                <th className="text-right">Cần thanh toán</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {monthlyDebts.map(debt => {
                const customer = state.customers.find(item => item.id === debt.customerId);
                const sale = state.profiles.find(profile => profile.id === customer?.assignedSaleId);
                const statement = statementByCustomer.get(debt.customerId);
                const payable = statement?.closingBalance ?? debt.closingBalance;

                return (
                  <tr key={debt.customerId}>
                    <td>
                      <div className="font-medium">{customer?.fullName || "—"}</div>
                      <div className="text-xs text-gray-500">{customer?.customerCode || "—"}</div>
                    </td>
                    <td>{sale?.fullName || "Công ty"}</td>
                    <td className="text-right">{debt.orders.length}</td>
                    <td className="text-right font-medium">{formatMoney(debt.totalDue)}</td>
                    <td className="text-right text-emerald-700">{formatMoney(debt.totalPaid)}</td>
                    <td className="text-right font-semibold text-red-600">{formatMoney(payable)}</td>
                    <td>{statement ? <StatusBadge status={statement.status} /> : <span className="badge-gray">Chưa chốt</span>}</td>
                    <td className="text-right whitespace-nowrap">
                      {statement ? (
                        <button className="btn-secondary btn-sm" onClick={() => setViewStatementId(statement.id)}>
                          <Eye className="h-3.5 w-3.5" /> Xem chứng từ
                        </button>
                      ) : (
                        <button className="btn-primary btn-sm" onClick={() => openClosing([debt])}>
                          <Percent className="h-3.5 w-3.5" /> CK sớm & chốt
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {monthlyDebts.length === 0 && <EmptyState title={`Không có đơn hàng trong ${formatPeriodMonth(period).toLowerCase()}`} />}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="px-3 py-2 border-b">
          <h2 className="font-semibold text-sm">Chứng từ công nợ đã phát hành</h2>
          <p className="text-xs text-gray-500 mt-0.5">Mỗi mã gồm phiếu đề nghị thanh toán và biên bản đối chiếu cùng một snapshot.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tháng</th>
                <th>Khách hàng</th>
                <th className="text-right">Giá trị đơn</th>
                <th className="text-right">CK số lượng</th>
                <th className="text-right">CK sớm</th>
                <th className="text-right">VAT</th>
                <th className="text-right">Sau VAT</th>
                <th className="text-right">Đề nghị TT</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {statements.map(statement => {
                const customer = state.customers.find(item => item.id === statement.customerId);
                const settlement = calculateDebtSettlement(
                  statement.totalDue,
                  statement.quantityDiscountAppliedAtOrder ? 0 : statement.quantityDiscountPct || 0,
                  statement.earlyPaymentDiscountPct || 0,
                  statement.vatPct ?? 0,
                  statement.earlyPaymentDiscountTiming || "before_vat",
                );
                const quantityAmount = statement.quantityDiscountAmount ?? settlement.quantityDiscountAmount;
                const earlyAmount = statement.earlyPaymentDiscountAmount ?? settlement.earlyPaymentDiscountAmount;
                const vatAmount = statement.vatAmount ?? settlement.vatAmount;
                const totalAfterVat = statement.totalAfterVat ?? settlement.totalAfterVat;

                return (
                  <tr key={statement.id}>
                    <td className="font-medium">{statement.code}</td>
                    <td>{formatPeriodMonth(statement.periodMonth)}</td>
                    <td>{customer?.fullName || "—"}</td>
                    <td className="text-right">{formatMoney(statement.totalDue)}</td>
                    <td className="text-right">{formatNumber(statement.quantityDiscountPct || 0, 2)}%<div className="text-xs text-gray-500">-{formatMoney(quantityAmount)}</div></td>
                    <td className="text-right">{formatNumber(statement.earlyPaymentDiscountPct || 0, 2)}%<div className="text-xs text-gray-500">-{formatMoney(earlyAmount)} · {statement.earlyPaymentDiscountTiming === "after_vat" ? "sau VAT" : "trước VAT"}</div></td>
                    <td className="text-right">{formatNumber(statement.vatPct ?? 0, 0)}%<div className="text-xs text-gray-500">{formatMoney(vatAmount)}</div></td>
                    <td className="text-right">{formatMoney(totalAfterVat)}</td>
                    <td className="text-right font-semibold">{formatMoney(statement.closingBalance)}</td>
                    <td className="text-right">
                      <button className="btn-secondary btn-sm" onClick={() => setViewStatementId(statement.id)} title="Xem hai chứng từ công nợ">
                        <FileText className="h-3.5 w-3.5" /> Xem
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {statements.length === 0 && <EmptyState title="Chưa phát hành chứng từ công nợ nào" />}
        </div>
      </section>

      <Modal
        open={closingDebts.length > 0}
        onClose={() => { setClosingCustomerIds([]); setDiscountDrafts({}); }}
        title={closingDebts.length === 1 ? "Chiết khấu thanh toán sớm và chốt công nợ" : `Chốt công nợ ${closingDebts.length} khách hàng`}
        size="xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setClosingCustomerIds([]); setDiscountDrafts({}); }}>Hủy</button>
            <button className="btn-primary" onClick={issueStatements}>
              <FileCheck2 className="h-4 w-4" /> Chốt và phát hành
            </button>
          </>
        }
      >
        <div className="mb-3 text-sm text-gray-600">
          Chiết khấu số lượng được lấy từ từng đơn hàng. Nhập chiết khấu thanh toán sớm và chọn giảm trước hoặc sau VAT {VAT_PCT}%.
        </div>
        <div className="overflow-x-auto">
          <table className="table-base border border-gray-200">
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th className="text-right">Trước CK số lượng</th>
                <th className="text-right">CK theo đơn</th>
                <th className="text-right">Sau CK 1</th>
                <th className="text-right">CK thanh toán sớm</th>
                <th>Vị trí CK 2</th>
                <th className="text-right">VAT 8%</th>
                <th className="text-right">Thành tiền</th>
                <th className="text-right">Đã TT</th>
                <th className="text-right">Còn phải TT</th>
              </tr>
            </thead>
            <tbody>
              {closingDebts.map(debt => {
                const customer = state.customers.find(item => item.id === debt.customerId);
                const draft = discountDrafts[debt.customerId] || {
                  earlyPaymentDiscountPct: 0,
                  earlyPaymentDiscountTiming: "before_vat" as const,
                };
                const settlement = calculateDebtSettlement(
                  debt.totalDue,
                  0,
                  draft.earlyPaymentDiscountPct,
                  VAT_PCT,
                  draft.earlyPaymentDiscountTiming,
                );
                const payable = Math.max(0, settlement.totalAfterVat - debt.totalPaid);

                return (
                  <tr key={debt.customerId}>
                    <td className="min-w-40"><div className="font-medium">{customer?.fullName || "—"}</div><div className="text-xs text-gray-500">{debt.orders.length} đơn</div></td>
                    <td className="text-right whitespace-nowrap">{formatMoney(debt.grossAmountBeforeQuantityDiscount)}</td>
                    <td className="text-right whitespace-nowrap">
                      {formatNumber(debt.quantityDiscountPct, 2)}%
                      <div className="text-xs text-gray-500">-{formatMoney(debt.quantityDiscountAmount)}</div>
                    </td>
                    <td className="text-right whitespace-nowrap">{formatMoney(debt.totalDue)}</td>
                    <td>
                      <div className="relative w-24 ml-auto">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          className="input pr-7 text-right"
                          value={draft.earlyPaymentDiscountPct}
                          onChange={event => updateDiscount(debt.customerId, { earlyPaymentDiscountPct: Number(event.target.value) })}
                          aria-label={`Chiết khấu thanh toán sớm ${customer?.fullName || "khách hàng"}`}
                        />
                        <span className="absolute right-2 top-2 text-sm text-gray-500">%</span>
                      </div>
                    </td>
                    <td>
                      <select
                        className="input min-w-28"
                        value={draft.earlyPaymentDiscountTiming}
                        onChange={event => updateDiscount(debt.customerId, { earlyPaymentDiscountTiming: event.target.value as EarlyPaymentDiscountTiming })}
                        aria-label={`Vị trí chiết khấu thanh toán sớm ${customer?.fullName || "khách hàng"}`}
                      >
                        <option value="before_vat">Trước VAT</option>
                        <option value="after_vat">Sau VAT</option>
                      </select>
                    </td>
                    <td className="text-right whitespace-nowrap">{formatMoney(settlement.vatAmount)}</td>
                    <td className="text-right font-medium whitespace-nowrap">{formatMoney(settlement.totalAfterVat)}</td>
                    <td className="text-right text-emerald-700 whitespace-nowrap">{formatMoney(debt.totalPaid)}</td>
                    <td className="text-right font-semibold text-red-600 whitespace-nowrap">{formatMoney(payable)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Modal>

      <DebtDocumentViewer
        statement={selectedStatement}
        state={state}
        preparedBy={user?.fullName || "—"}
        onClose={() => setViewStatementId(null)}
      />
    </div>
  );
}
