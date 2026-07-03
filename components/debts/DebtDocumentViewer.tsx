"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Printer, Scale } from "lucide-react";
import Modal from "@/components/Modal";
import { SELLER_COMPANY } from "@/lib/company";
import {
  amountInVietnameseWords,
  buildDebtStatementLines,
  buildMonthlyCustomerDebts,
  calculateDebtSettlement,
  formatPeriodMonth,
  formatVietnameseLongDate,
  type DebtSettlement,
} from "@/lib/debts";
import type { State } from "@/lib/store";
import { CUSTOMER_GROUP_LABEL, formatDate, formatMoney, formatNumber } from "@/lib/utils";
import type {
  DebtStatement,
  DebtStatementLineSnapshot,
  DebtStatementOrderSnapshot,
} from "@/types";

type DocumentType = "payment" | "reconciliation";

export default function DebtDocumentViewer({
  statement,
  state,
  preparedBy,
  onClose,
}: {
  statement: DebtStatement | null;
  state: State;
  preparedBy: string;
  onClose: () => void;
}) {
  const [documentType, setDocumentType] = useState<DocumentType>("payment");

  useEffect(() => {
    setDocumentType("payment");
  }, [statement?.id]);

  return (
    <Modal
      open={Boolean(statement)}
      onClose={onClose}
      title={statement ? `${statement.code} - ${formatPeriodMonth(statement.periodMonth)}` : "Chứng từ công nợ"}
      size="xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Đóng</button>
          <button className="btn-primary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> In / Lưu PDF
          </button>
        </>
      }
    >
      {statement && (
        <>
          <div className="mb-4 inline-flex rounded-md bg-gray-100 p-1 print:hidden" role="tablist" aria-label="Loại chứng từ">
            <button
              className={`inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium ${documentType === "payment" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
              onClick={() => setDocumentType("payment")}
              role="tab"
              aria-selected={documentType === "payment"}
            >
              <FileText className="h-4 w-4" /> Phiếu đề nghị thanh toán
            </button>
            <button
              className={`inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium ${documentType === "reconciliation" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
              onClick={() => setDocumentType("reconciliation")}
              role="tab"
              aria-selected={documentType === "reconciliation"}
            >
              <Scale className="h-4 w-4" /> Biên bản đối chiếu công nợ
            </button>
          </div>

          {documentType === "payment" ? (
            <PaymentRequest statement={statement} state={state} preparedBy={preparedBy} />
          ) : (
            <DebtReconciliation statement={statement} state={state} />
          )}
        </>
      )}
    </Modal>
  );
}

function useStatementData(statement: DebtStatement, state: State) {
  return useMemo(() => {
    const customer = state.customers.find(item => item.id === statement.customerId);
    const sale = state.profiles.find(profile => profile.id === customer?.assignedSaleId);
    const firstBranch = state.branches.find(branch => branch.customerId === statement.customerId);
    const fallbackOrders = state.orders.filter(order =>
      order.customerId === statement.customerId &&
      order.status === "active" &&
      order.orderDate.startsWith(statement.periodMonth) &&
      (!statement.orderIds || statement.orderIds.includes(order.id)),
    );
    const fallbackDebt = buildMonthlyCustomerDebts(statement.periodMonth, fallbackOrders, state.receipts)
      .find(debt => debt.customerId === statement.customerId);
    const fallbackMonthlyOrders = fallbackDebt?.orders || [];
    const orderSnapshots: DebtStatementOrderSnapshot[] = statement.orderSnapshots || fallbackMonthlyOrders.map(item => ({
      orderId: item.order.id,
      orderCode: item.order.orderCode,
      orderDate: item.order.orderDate,
      branchId: item.order.branchId,
      amount: item.dueAmount,
      paidAmount: item.paidAmount,
      grossAmount: item.grossAmountBeforeQuantityDiscount,
      quantityDiscountPct: item.order.discountMonthlyPct || 0,
      quantityDiscountAmount: item.quantityDiscountAmount,
    }));
    const lineSnapshots: DebtStatementLineSnapshot[] = statement.lineSnapshots ||
      buildDebtStatementLines(
        fallbackMonthlyOrders,
        state.products,
        statement.grossAmountBeforeQuantityDiscount ?? statement.totalDue,
      );
    const vatPct = statement.vatPct ?? 0;
    const quantityDiscountAppliedAtOrder = statement.quantityDiscountAppliedAtOrder === true;
    const calculated = calculateDebtSettlement(
      statement.totalDue,
      quantityDiscountAppliedAtOrder ? 0 : statement.quantityDiscountPct || 0,
      statement.earlyPaymentDiscountPct || 0,
      vatPct,
      statement.earlyPaymentDiscountTiming || "before_vat",
    );
    const settlement = {
      ...calculated,
      quantityDiscountPct: statement.quantityDiscountPct ?? calculated.quantityDiscountPct,
      quantityDiscountAmount: statement.quantityDiscountAmount ?? calculated.quantityDiscountAmount,
      afterQuantityDiscount: quantityDiscountAppliedAtOrder ? statement.totalDue : calculated.afterQuantityDiscount,
      earlyPaymentDiscountAmount: statement.earlyPaymentDiscountAmount ?? calculated.earlyPaymentDiscountAmount,
      earlyPaymentDiscountTiming: statement.earlyPaymentDiscountTiming || calculated.earlyPaymentDiscountTiming,
      taxableAmount: statement.taxableAmount ?? calculated.taxableAmount,
      vatAmount: statement.vatAmount ?? calculated.vatAmount,
      totalBeforeEarlyPaymentDiscount: statement.totalBeforeEarlyPaymentDiscount ?? calculated.totalBeforeEarlyPaymentDiscount,
      totalAfterVat: statement.totalAfterVat ?? calculated.totalAfterVat,
    };
    const createdAt = statement.createdAt ? new Date(statement.createdAt) : new Date();

    return {
      customer,
      sale,
      orderSnapshots,
      lineSnapshots,
      settlement,
      createdAt,
      buyer: {
        name: customer?.companyName || customer?.fullName || "—",
        displayName: customer?.fullName || "—",
        address: customer?.companyAddress || firstBranch?.address || "—",
        phone: customer?.companyPhone || customer?.phone || "—",
        fax: customer?.companyFax || "—",
        representative: customer?.legalRepresentative || customer?.contactName || customer?.fullName || "—",
        representativeTitle: customer?.legalRepresentativeTitle || "Đại diện",
      },
    };
  }, [statement, state]);
}

function PaymentRequest({
  statement,
  state,
  preparedBy,
}: {
  statement: DebtStatement;
  state: State;
  preparedBy: string;
}) {
  const data = useStatementData(statement, state);
  const { buyer, customer, sale, orderSnapshots, settlement, createdAt } = data;

  return (
    <article className="debt-document-print bg-white text-gray-900">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-4 border-b-2 border-gray-900">
        <div>
          <div className="text-lg font-bold">{SELLER_COMPANY.name}</div>
          <div className="text-xs text-gray-600 mt-1">Điện thoại: {SELLER_COMPANY.phone}</div>
          <div className="text-xs text-gray-600">TK: {SELLER_COMPANY.bankAccount} - {SELLER_COMPANY.bankBranch}</div>
          <div className="text-xs text-gray-600">Chủ TK: {SELLER_COMPANY.bankAccountName}</div>
        </div>
        <div className="sm:text-right">
          <h2 className="text-xl font-bold uppercase">Phiếu đề nghị thanh toán</h2>
          <div className="text-sm mt-1">Số: <strong>{statement.code}</strong></div>
          <div className="text-sm">Ngày lập: {formatDate(createdAt)}</div>
        </div>
      </header>

      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 py-4 text-sm border-b border-gray-300">
        <InfoRow label="Đơn vị thanh toán" value={buyer.name} />
        <InfoRow label="Mã khách" value={customer?.customerCode || "—"} />
        <InfoRow label="Tên giao dịch" value={buyer.displayName} />
        <InfoRow label="Kỳ thanh toán" value={formatPeriodMonth(statement.periodMonth)} />
        <InfoRow label="Địa chỉ" value={buyer.address} />
        <InfoRow label="Điện thoại" value={buyer.phone} />
        <InfoRow label="Người đại diện" value={`${buyer.representative} - ${buyer.representativeTitle}`} />
        <InfoRow label="Sale phụ trách" value={sale?.fullName || "Công ty"} />
      </div>

      <div className="overflow-x-auto my-5">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-2 text-center w-12">STT</th>
              <th className="border border-gray-300 px-2 py-2 text-left">Ngày đơn</th>
              <th className="border border-gray-300 px-2 py-2 text-left">Mã đơn</th>
              <th className="border border-gray-300 px-2 py-2 text-left">Chi nhánh</th>
              <th className="border border-gray-300 px-2 py-2 text-right">Trước CK</th>
              <th className="border border-gray-300 px-2 py-2 text-right">CK số lượng</th>
              <th className="border border-gray-300 px-2 py-2 text-right">Sau CK</th>
            </tr>
          </thead>
          <tbody>
            {orderSnapshots.map((order, index) => {
              const branch = state.branches.find(item => item.id === order.branchId);
              return (
                <tr key={order.orderId}>
                  <td className="border border-gray-300 px-2 py-2 text-center">{index + 1}</td>
                  <td className="border border-gray-300 px-2 py-2 whitespace-nowrap">{formatDate(order.orderDate)}</td>
                  <td className="border border-gray-300 px-2 py-2 font-medium whitespace-nowrap">{order.orderCode}</td>
                  <td className="border border-gray-300 px-2 py-2">{branch?.branchName || "—"}</td>
                  <td className="border border-gray-300 px-2 py-2 text-right whitespace-nowrap">{formatMoney(order.grossAmount ?? order.amount + (order.quantityDiscountAmount || 0))}</td>
                  <td className="border border-gray-300 px-2 py-2 text-right whitespace-nowrap">
                    {formatNumber(order.quantityDiscountPct || 0, 2)}%
                    <div className="text-xs text-gray-500">-{formatMoney(order.quantityDiscountAmount || 0)}</div>
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-right whitespace-nowrap">{formatMoney(order.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SettlementSummary statement={statement} settlement={settlement} />

      <div className="mt-5 border-t border-gray-300 pt-4 text-sm">
        <div><span className="text-gray-600">Số tiền đề nghị thanh toán bằng chữ:</span> <strong>{amountInVietnameseWords(statement.closingBalance)}</strong></div>
        <div className="mt-2 text-gray-700">
          VAT {formatNumber(settlement.vatPct, 0)}% được tính {settlement.earlyPaymentDiscountTiming === "before_vat" ? "sau chiết khấu thanh toán sớm" : "trước chiết khấu thanh toán sớm"}.
        </div>
        {settlement.earlyPaymentDiscountPct > 0 && (
          <div className="mt-1 text-gray-700">Chiết khấu thanh toán sớm {formatNumber(settlement.earlyPaymentDiscountPct, 2)}% được áp dụng {settlement.earlyPaymentDiscountTiming === "before_vat" ? "trước VAT" : "sau VAT"} theo thỏa thuận giữa hai bên.</div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6 mt-10 text-center text-sm">
        <Signature title="Người lập phiếu" name={preparedBy} />
        <Signature title="Kế toán" />
        <Signature title="Đơn vị thanh toán" />
      </div>
    </article>
  );
}

function DebtReconciliation({ statement, state }: { statement: DebtStatement; state: State }) {
  const data = useStatementData(statement, state);
  const { buyer, lineSnapshots, settlement, createdAt } = data;
  const regularSettlement = calculateDebtSettlement(
    statement.totalDue,
    statement.quantityDiscountAppliedAtOrder ? 0 : statement.quantityDiscountPct || 0,
    0,
    statement.vatPct ?? 0,
  );
  const regularPayable = Math.max(0, regularSettlement.totalAfterVat - statement.totalPaid);
  const paymentDeadline = new Date(createdAt);
  paymentDeadline.setDate(paymentDeadline.getDate() + 15);

  return (
    <article className="debt-document-print bg-white text-gray-900 text-sm">
      <header className="grid grid-cols-2 gap-6 text-center">
        <div className="font-bold uppercase">{SELLER_COMPANY.name}</div>
        <div>
          <div className="font-bold uppercase">Cộng hòa Xã hội Chủ nghĩa Việt Nam</div>
          <div className="font-semibold mt-1">Độc lập - Tự do - Hạnh phúc</div>
          <div className="mt-3 italic">Hà Nội, {formatVietnameseLongDate(createdAt)}</div>
        </div>
      </header>

      <h2 className="text-xl font-bold uppercase text-center mt-8">Biên bản đối chiếu công nợ</h2>
      <div className="text-center mt-1">Số: {statement.code} - Kỳ {formatPeriodMonth(statement.periodMonth).toLowerCase()}</div>

      <div className="mt-6 space-y-1">
        <p>- Căn cứ vào biên bản giao nhận hàng hóa và các đơn hàng phát sinh trong kỳ.</p>
        <p>- Căn cứ vào thỏa thuận giữa hai bên.</p>
        <p>Hôm nay, {formatVietnameseLongDate(createdAt)}, tại văn phòng {SELLER_COMPANY.name}, chúng tôi gồm có:</p>
      </div>

      <section className="mt-4 space-y-1">
        <h3 className="font-bold">1. Bên A (Bên mua): {buyer.name}</h3>
        <p>- Địa chỉ: {buyer.address}</p>
        <p>- Điện thoại: {buyer.phone} <span className="ml-6">Fax: {buyer.fax}</span></p>
        <p>- Đại diện: {buyer.representative} <span className="ml-6">Chức vụ: {buyer.representativeTitle}</span></p>
      </section>

      <section className="mt-4 space-y-1">
        <h3 className="font-bold">2. Bên B (Bên bán): {SELLER_COMPANY.name}</h3>
        <p>- Điện thoại: {SELLER_COMPANY.phone}</p>
        <p>- Đại diện: {SELLER_COMPANY.representative} <span className="ml-6">Chức vụ: {SELLER_COMPANY.representativeTitle}</span></p>
        <p>- Số tài khoản: {SELLER_COMPANY.bankAccount} - {SELLER_COMPANY.bankBranch}</p>
        <p>- Tên tài khoản: {SELLER_COMPANY.bankAccountName}</p>
      </section>

      <p className="font-semibold mt-5">Cùng nhau đối chiếu khối lượng và giá trị cụ thể như sau:</p>

      <div className="overflow-x-auto mt-3">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-green-100">
              <th className="border border-gray-500 px-2 py-2 text-center w-10">STT</th>
              <th className="border border-gray-500 px-2 py-2 text-left">Tên sản phẩm / Diễn giải</th>
              <th className="border border-gray-500 px-2 py-2 text-center">ĐVT</th>
              <th className="border border-gray-500 px-2 py-2 text-right">Số lượng</th>
              <th className="border border-gray-500 px-2 py-2 text-right">Đơn giá</th>
              <th className="border border-gray-500 px-2 py-2 text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {lineSnapshots.map((line, index) => (
              <tr key={`${line.description}-${index}`}>
                <td className="border border-gray-500 px-2 py-2 text-center">{index + 1}</td>
                <td className="border border-gray-500 px-2 py-2">{line.description}</td>
                <td className="border border-gray-500 px-2 py-2 text-center">{line.unit}</td>
                <td className="border border-gray-500 px-2 py-2 text-right">{formatNumber(line.quantity, Number.isInteger(line.quantity) ? 0 : 2)}</td>
                <td className="border border-gray-500 px-2 py-2 text-right">{formatMoney(line.unitPrice)}</td>
                <td className="border border-gray-500 px-2 py-2 text-right font-medium">{formatMoney(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 space-y-4 leading-6">
        <p><strong>1. Công nợ đầu kỳ:</strong> {formatMoney(statement.openingBalance)}</p>

        <div>
          <p><strong>2. Số phát sinh trong kỳ:</strong></p>
          <div className="ml-5 mt-1 grid sm:grid-cols-2 gap-x-8 gap-y-1">
            <SettlementCalculationRows statement={statement} settlement={settlement} />
          </div>
        </div>

        <p>
          <strong>3. Số tiền Bên A đã thanh toán:</strong> {formatMoney(statement.totalPaid)}
          {" "}({amountInVietnameseWords(statement.totalPaid)}).
        </p>

        <div>
          <p>
            <strong>4. Kết luận:</strong> Tính đến {formatVietnameseLongDate(paymentDeadline)}, tức sau 15 ngày kể từ ngày nhận được
            biên bản đối chiếu này, Bên A phải thanh toán cho Bên B số tiền là: <strong>{formatMoney(regularPayable)}</strong>
            {" "}(tức {amountInVietnameseWords(regularPayable).toLowerCase()}).
          </p>
          {settlement.earlyPaymentDiscountPct > 0 && (
            <p className="mt-3">
              Nếu quý công ty thanh toán sớm theo thời hạn thỏa thuận sẽ được giảm {formatNumber(settlement.earlyPaymentDiscountPct, 2)}%
              {settlement.earlyPaymentDiscountTiming === "before_vat"
                ? " trên giá trị sau chiết khấu số lượng và trước VAT"
                : " trên tổng giá trị đã bao gồm VAT"}; số tiền còn phải thanh toán là <strong>{formatMoney(statement.closingBalance)}</strong>
              {" "}(tức {amountInVietnameseWords(statement.closingBalance).toLowerCase()}).
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 leading-6">
        Biên bản này được lập thành 02 bản có giá trị như nhau. Mỗi bên giữ 01 bản làm cơ sở thanh toán.
        Trong vòng 03 ngày làm việc kể từ ngày nhận được biên bản mà Bên B không nhận được phản hồi từ Bên A,
        số liệu công nợ trên được coi là đã được hai bên chấp thuận.
      </p>

      <div className="grid grid-cols-2 gap-16 mt-10 text-center">
        <Signature title="Đại diện Bên A" />
        <Signature title="Đại diện Bên B" name={SELLER_COMPANY.representative} />
      </div>
    </article>
  );
}

function SettlementSummary({ statement, settlement }: { statement: DebtStatement; settlement: DebtSettlement }) {
  return (
    <div className="ml-auto w-full sm:max-w-md text-sm space-y-2">
      <SettlementCalculationRows statement={statement} settlement={settlement} />
      <SummaryRow label="Đã thanh toán" value={`- ${formatMoney(statement.totalPaid)}`} />
      <div className="flex justify-between gap-4 border-t-2 border-gray-900 pt-2 text-base font-bold">
        <span>Đề nghị thanh toán</span>
        <span className="whitespace-nowrap">{formatMoney(statement.closingBalance)}</span>
      </div>
    </div>
  );
}

function SettlementCalculationRows({
  statement,
  settlement,
}: {
  statement: DebtStatement;
  settlement: DebtSettlement;
}) {
  const grossAmount = statement.grossAmountBeforeQuantityDiscount ?? statement.totalDue;
  const quantityLabel = statement.quantityDiscountAppliedAtOrder
    ? `Chiết khấu số lượng theo đơn (bình quân ${formatNumber(settlement.quantityDiscountPct, 2)}%)`
    : `Chiết khấu số lượng (${formatNumber(settlement.quantityDiscountPct, 2)}%)`;
  const earlyLabel = `Chiết khấu thanh toán sớm (${formatNumber(settlement.earlyPaymentDiscountPct, 2)}% - ${settlement.earlyPaymentDiscountTiming === "before_vat" ? "trước VAT" : "sau VAT"})`;

  return (
    <>
      <SummaryRow label="Tổng giá trị trước chiết khấu số lượng" value={formatMoney(grossAmount)} />
      <SummaryRow label={quantityLabel} value={`- ${formatMoney(settlement.quantityDiscountAmount)}`} />
      <SummaryRow label="Sau chiết khấu số lượng" value={formatMoney(settlement.afterQuantityDiscount)} />
      {settlement.earlyPaymentDiscountTiming === "before_vat" ? (
        <>
          <SummaryRow label={earlyLabel} value={`- ${formatMoney(settlement.earlyPaymentDiscountAmount)}`} />
          <SummaryRow label="Cộng tiền hàng trước VAT" value={formatMoney(settlement.taxableAmount)} />
          <SummaryRow label={`VAT (${formatNumber(settlement.vatPct, 0)}%)`} value={formatMoney(settlement.vatAmount)} />
        </>
      ) : (
        <>
          <SummaryRow label="Cộng tiền hàng trước VAT" value={formatMoney(settlement.taxableAmount)} />
          <SummaryRow label={`VAT (${formatNumber(settlement.vatPct, 0)}%)`} value={formatMoney(settlement.vatAmount)} />
          <SummaryRow label="Cộng sau VAT trước CK thanh toán sớm" value={formatMoney(settlement.totalBeforeEarlyPaymentDiscount)} />
          <SummaryRow label={earlyLabel} value={`- ${formatMoney(settlement.earlyPaymentDiscountAmount)}`} />
        </>
      )}
      <SummaryRow label="Tổng cộng phải thanh toán" value={formatMoney(settlement.totalAfterVat)} strong />
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div><span className="text-gray-500">{label}:</span> <strong className="font-medium">{value}</strong></div>;
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between gap-4 ${strong ? "font-semibold" : ""}`}><span className="text-gray-600">{label}</span><span className="whitespace-nowrap">{value}</span></div>;
}

function Signature({ title, name }: { title: string; name?: string }) {
  return (
    <div>
      <div className="font-semibold uppercase">{title}</div>
      <div className="text-xs text-gray-500 mt-1 normal-case">(Ký, ghi rõ họ tên và đóng dấu)</div>
      <div className="h-20" />
      <div className="font-medium min-h-5 normal-case">{name || ""}</div>
    </div>
  );
}
