"use client";
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { ReceiptBadge } from "@/components/Badge";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDate, formatMoney, todayISO, RECEIPT_STATUS_LABEL } from "@/lib/utils";
import { CheckCircle2, XCircle, Send, ShieldAlert } from "lucide-react";

export default function ReceiptsPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const [fStatus, setFStatus] = useState("");

  const isAdmin = user?.role === "admin";
  const canApprove = can(user?.role, "approve_receipt");
  const canCreate = can(user?.role, "create_receipt");

  const rows = useMemo(() => state.receipts
    .filter(r => !fStatus || r.status === fStatus)
    .sort((a, b) => (b.receiptDate || "").localeCompare(a.receiptDate || "")), [state.receipts, fStatus]);

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

      <div className="card p-3 flex gap-2">
        <select className="input w-52" value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(RECEIPT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr>
            <th>Mã PT</th><th>Ngày</th><th>Khách</th><th>Đơn</th><th>PT thanh toán</th>
            <th className="text-right">Số tiền</th><th>Trạng thái</th><th>Người duyệt</th><th></th>
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
