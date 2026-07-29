"use client";
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { ReceiptBadge } from "@/components/Badge";
import SortableHeader, { type SortDirection } from "@/components/SortableHeader";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDate, formatMoney, todayISO, RECEIPT_STATUS_LABEL } from "@/lib/utils";
import { CheckCircle2, XCircle, Send, ShieldAlert, RotateCcw } from "lucide-react";

type ReceiptSortColumn = "code" | "date" | "customer" | "order" | "paymentMethod" | "amount" | "status" | "approver";

export default function ReceiptsPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const [fStatus, setFStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortColumn, setSortColumn] = useState<ReceiptSortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const canApprove = can(user?.role, "approve_receipt");
  const canCreate = can(user?.role, "create_receipt");

  const rows = useMemo(() => {
    const filtered = state.receipts.filter(receipt => {
      if (fStatus && receipt.status !== fStatus) return false;
      if (from && receipt.receiptDate < from) return false;
      if (to && receipt.receiptDate > to) return false;
      return true;
    });

    const valueOf = (receipt: typeof state.receipts[number]): string | number => {
      switch (sortColumn) {
        case "code": return receipt.receiptCode;
        case "date": return receipt.receiptDate || "";
        case "customer": return state.customers.find(customer => customer.id === receipt.customerId)?.fullName || "";
        case "order": return state.orders.find(order => order.id === receipt.orderId)?.orderCode || "";
        case "paymentMethod": return receipt.paymentMethod;
        case "amount": return receipt.amount;
        case "status": return RECEIPT_STATUS_LABEL[receipt.status] || receipt.status;
        case "approver": return state.profiles.find(profile => profile.id === receipt.approvedBy)?.fullName || "";
      }
    };

    return [...filtered].sort((a, b) => {
      const left = valueOf(a);
      const right = valueOf(b);
      const comparison = typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right), "vi", { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [state.receipts, state.customers, state.orders, state.profiles, fStatus, from, to, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    const nextColumn = column as ReceiptSortColumn;
    if (nextColumn === sortColumn) {
      setSortDirection(current => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortColumn(nextColumn);
    setSortDirection(nextColumn === "date" ? "desc" : "asc");
  };

  const stats = useMemo(() => {
    const pending = state.receipts.filter(r => r.status === "pending" || r.status === "waiting_admin");
    const approved = state.receipts.filter(r => r.status === "approved");
    return {
      pendingAmount: pending.reduce((s, r) => s + r.amount, 0),
      pendingCount: pending.length,
      approvedAmount: approved.reduce((s, r) => s + r.amount, 0),
      waitingAdmin: state.receipts.filter(r => r.status === "waiting_admin").length,
    };
  }, [state.receipts]);

  const reportTransferred = (id: string) => {
    update(s => ({ ...s, receipts: s.receipts.map(r => r.id === id ? { ...r, status: "waiting_admin", note: "Khách báo đã chuyển khoản" } : r) }));
  };
  const approve = (id: string) => {
    update(s => ({ ...s, receipts: s.receipts.map(r => r.id === id ? { ...r, status: "approved", approvedBy: user!.id, approvedAt: todayISO() } : r) }));
  };
  const reject = (id: string) => {
    const note = prompt("Lý do từ chối:") || "";
    update(s => ({ ...s, receipts: s.receipts.map(r => r.id === id ? { ...r, status: "rejected", note } : r) }));
  };
  const cancelApproval = (id: string) => {
    if (!confirm("Huỷ duyệt phiếu thu này? Đơn hàng liên quan sẽ chuyển về Chưa CK.")) return;
    update(current => {
      const receipt = current.receipts.find(item => item.id === id);
      return {
        ...current,
        receipts: current.receipts.map(item => item.id === id ? {
          ...item,
          status: "pending",
          paymentMethod: "chuyển khoản",
          approvedBy: undefined,
          approvedAt: undefined,
          note: "Admin huỷ duyệt, chờ xác nhận chuyển khoản lại",
        } : item),
        orders: receipt?.orderId
          ? current.orders.map(order => order.id === receipt.orderId ? { ...order, paymentStatus: "chua_ck" as const } : order)
          : current.orders,
      };
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Phiếu thu" subtitle="Chỉ Admin được xác nhận tiền đã về tài khoản" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Chờ thu" value={formatMoney(stats.pendingAmount)} hint={`${stats.pendingCount} phiếu`} tone="warn" />
        <StatCard label="Chờ Admin duyệt" value={stats.waitingAdmin} hint="Khách báo đã CK" tone={stats.waitingAdmin ? "warn" : "default"} />
        <StatCard label="Đã thu (approved)" value={formatMoney(stats.approvedAmount)} tone="good" />
        <StatCard label="Quyền duyệt" value={canApprove ? "Có" : "Không"} hint={canApprove ? "Bạn là Admin" : "Chỉ Admin"} />
      </div>

      {!canApprove && (
        <div className="card p-3 bg-amber-50 border-amber-200 text-sm flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          Tài khoản của bạn không có quyền duyệt phiếu thu. Chỉ <b>Admin</b> mới xác nhận "tiền đã về".
        </div>
      )}

      <div className="card p-3 flex flex-wrap gap-2 items-center">
        <input type="date" className="input w-40" value={from} onChange={event => setFrom(event.target.value)} aria-label="Từ ngày" />
        <span className="text-xs text-gray-500">→</span>
        <input type="date" className="input w-40" value={to} onChange={event => setTo(event.target.value)} aria-label="Đến ngày" />
        <select className="input w-52" value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(RECEIPT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr>
            <SortableHeader label="Mã PT" column="code" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
            <SortableHeader label="Ngày" column="date" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
            <SortableHeader label="Khách" column="customer" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
            <SortableHeader label="Đơn" column="order" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
            <SortableHeader label="PT thanh toán" column="paymentMethod" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
            <SortableHeader label="Số tiền" column="amount" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
            <SortableHeader label="Trạng thái" column="status" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
            <SortableHeader label="Người duyệt" column="approver" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
            <th></th>
          </tr></thead>
          <tbody>
            {rows.map(r => {
              const c = state.customers.find(x => x.id === r.customerId);
              const o = state.orders.find(x => x.id === r.orderId);
              const approver = state.profiles.find(p => p.id === r.approvedBy);
              return (
                <tr key={r.id}>
                  <td className="font-medium">{r.receiptCode}</td>
                  <td>{formatDate(r.receiptDate)}</td>
                  <td>{c?.fullName || "—"}</td>
                  <td>{o?.orderCode || "—"}</td>
                  <td>{r.paymentMethod}</td>
                  <td className="text-right font-medium">{formatMoney(r.amount)}</td>
                  <td><ReceiptBadge status={r.status} /></td>
                  <td>{approver?.fullName || "—"}</td>
                  <td className="whitespace-nowrap space-x-1">
                    {canCreate && r.status === "pending" && (
                      <button className="btn-secondary btn-sm" onClick={() => reportTransferred(r.id)} title="Khách báo đã CK">
                        <Send className="h-3.5 w-3.5" /> Báo đã CK
                      </button>
                    )}
                    {canApprove && (r.status === "pending" || r.status === "waiting_admin") && (
                      <>
                        <button className="btn-primary btn-sm" onClick={() => approve(r.id)}><CheckCircle2 className="h-3.5 w-3.5" /> Duyệt</button>
                        <button className="btn-ghost btn-sm text-red-600" onClick={() => reject(r.id)}><XCircle className="h-3.5 w-3.5" /></button>
                      </>
                    )}
                    {canApprove && r.status === "approved" && (
                      <button className="btn-secondary btn-sm" onClick={() => cancelApproval(r.id)} title="Huỷ duyệt và đưa đơn về Chưa CK">
                        <RotateCcw className="h-3.5 w-3.5" /> Huỷ duyệt
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState />}
      </div>
    </div>
  );
}
