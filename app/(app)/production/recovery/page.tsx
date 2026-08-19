"use client";
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { adjustInventory, invQty } from "@/lib/inventory";
import { formatDate, formatKg, formatMoney, nextSequentialCode, newId, todayISO } from "@/lib/utils";
import { Plus, RotateCcw, Send } from "lucide-react";
import type { RecoveryLog, DestructionLog, Expense, StockTransfer } from "@/types";

export default function RecoveryPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const canManage = can(user?.role, "manage_recovery");
  const [tab, setTab] = useState<"recover" | "destroy">("recover");

  const [df, setDf] = useState({ logDate: todayISO(), productId: state.products[0]?.id || "", warehouse: "factory" as "factory" | "cl", qtyKg: 0, reason: "" });
  const prodName = (id: string) => state.products.find(p => p.id === id)?.name || "—";

  // MCK cần recover = phiếu chuyển CL→Xưởng đã nhận, chưa hút lại
  const recoveredTransferIds = useMemo(() => new Set(state.recoveryLogs.map(r => r.transferId).filter(Boolean)), [state.recoveryLogs]);
  const mckToRecover = useMemo(
    () => state.transfers.filter(t => (t.direction === "cl_to_factory") && t.status === "received" && !recoveredTransferIds.has(t.id)),
    [state.transfers, recoveredTransferIds],
  );
  // Đang trên đường về xưởng (chờ xác nhận)
  const mckInTransit = useMemo(
    () => state.transfers.filter(t => t.direction === "cl_to_factory" && t.status === "pending"),
    [state.transfers],
  );

  // Hút lại → vào kho recover riêng (không cộng tồn xưởng tổng, không cộng chi phí)
  const pullBack = (transferId: string) => {
    const t = state.transfers.find(x => x.id === transferId);
    if (!t) return;
    const log: RecoveryLog = {
      id: newId(), logDate: todayISO(), productId: t.productId, qtyKg: t.qtyKg,
      note: "Hút lại từ MCK", createdBy: user!.id,
      transferId: t.id, mckLogId: t.mckLogId, sentToFactoryDate: t.transferDate,
    };
    update(s => ({
      ...s,
      recoveryLogs: [log, ...s.recoveryLogs],
      recoverInventory: adjustInventory(s.recoverInventory, t.productId, t.qtyKg),
      mckLogs: t.mckLogId ? s.mckLogs.map(m => m.id === t.mckLogId ? { ...m, status: "recovered" } : m) : s.mckLogs,
    }));
  };

  // Chuyển hàng recover về Kho Cát Linh (tạo phiếu chuyển recover_to_cl, chờ CL xác nhận)
  const sendToCl = (productId: string) => {
    const avail = invQty(state.recoverInventory, productId);
    if (avail <= 0) return;
    const input = prompt(`Chuyển bao nhiêu kg ${prodName(productId)} về Kho Cát Linh? (tồn recover ${avail} kg)`, String(avail));
    if (input == null) return;
    const qty = Number(input);
    if (!Number.isFinite(qty) || qty <= 0 || qty > avail) { alert("Số lượng không hợp lệ"); return; }
    update(s => {
      const tr: StockTransfer = {
        id: newId(), transferCode: nextSequentialCode("TR", s.transfers.map(t => t.transferCode)),
        transferDate: todayISO(), productId, qtyKg: qty, status: "pending", direction: "recover_to_cl",
        note: "Hàng recover chuyển về Cát Linh",
      };
      return {
        ...s,
        transfers: [tr, ...s.transfers],
        recoverInventory: adjustInventory(s.recoverInventory, productId, -qty),
      };
    });
  };

  // Tiêu huỷ trực tiếp tại xưởng/CL → trừ tồn + phiếu chi = fix_cost × SL
  const addDestruction = () => {
    if (df.qtyKg <= 0) { alert("Nhập kg tiêu huỷ"); return; }
    const avail = df.warehouse === "factory" ? invQty(state.factoryInventory, df.productId) : invQty(state.clInventory, df.productId);
    if (df.qtyKg > avail) { alert(`Tồn ${df.warehouse === "factory" ? "kho Xưởng" : "kho CL"} không đủ (còn ${avail} kg).`); return; }
    const prod = state.products.find(p => p.id === df.productId);
    const unitCost = prod?.fixCost || 0;
    const total = Math.round(df.qtyKg * unitCost);
    const expenseId = newId();
    const logId = newId();
    const expense: Expense = {
      id: expenseId, code: nextSequentialCode("PC", state.expenses.map(e => e.code)), date: df.logDate, type: "destruction",
      amount: total, refId: logId,
      note: `Tiêu huỷ ${df.qtyKg}kg ${prod?.name} (${df.warehouse === "factory" ? "Xưởng" : "Kho CL"})${df.reason ? " — " + df.reason : ""}`,
      createdBy: user!.id, createdAt: new Date().toISOString(),
    };
    const log: DestructionLog = {
      id: logId, logDate: df.logDate, productId: df.productId, warehouse: df.warehouse,
      qtyKg: df.qtyKg, unitCost, totalLoss: total, reason: df.reason, expenseId, createdBy: user!.id,
    };
    update(s => ({
      ...s,
      destructionLogs: [log, ...s.destructionLogs],
      expenses: [expense, ...s.expenses],
      factoryInventory: df.warehouse === "factory" ? adjustInventory(s.factoryInventory, df.productId, -df.qtyKg) : s.factoryInventory,
      clInventory: df.warehouse === "cl" ? adjustInventory(s.clInventory, df.productId, -df.qtyKg) : s.clInventory,
    }));
    setDf({ logDate: todayISO(), productId: state.products[0]?.id || "", warehouse: "factory", qtyKg: 0, reason: "" });
  };

  const totalDestroyExpense = state.expenses.filter(e => e.type === "destruction").reduce((s, e) => s + e.amount, 0);
  const recoverStockTotal = state.recoverInventory.reduce((s, r) => s + r.qtyKg, 0);
  const returnedThisMonth = state.transfers.filter(t => t.direction === "recover_to_cl" && t.transferDate.startsWith(todayISO().slice(0, 7))).reduce((s, t) => s + t.qtyKg, 0);
  const recoverRows = state.recoverInventory.filter(r => r.qtyKg > 0.001);

  return (
    <div className="space-y-4">
      <PageHeader title="Hàng recover / tiêu huỷ" subtitle="MCK chuyển về xưởng → hút lại vào Kho Recover riêng → chuyển về Cát Linh • Tiêu huỷ → trừ tồn + phiếu chi" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="MCK chờ recover" value={mckToRecover.length} hint={`${mckInTransit.length} đang trên đường`} tone={mckToRecover.length ? "warn" : "default"} />
        <StatCard label="Tồn kho Recover" value={formatKg(recoverStockTotal)} tone={recoverStockTotal ? "good" : "default"} />
        <StatCard label="Đã chuyển về CL (tháng)" value={formatKg(returnedThisMonth)} />
        <StatCard label="Tổng chi tiêu huỷ" value={formatMoney(totalDestroyExpense)} tone={totalDestroyExpense ? "bad" : "default"} />
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {[{ k: "recover", label: "Recover (MCK → Kho Recover → Cát Linh)" }, { k: "destroy", label: "Tiêu huỷ → Phiếu chi" }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.k ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "recover" && (
        <>
          {/* MCK cần recover */}
          <div className="card overflow-x-auto">
            <div className="px-3 py-2 border-b font-semibold text-sm">MCK cần recover (đã nhận tại xưởng)</div>
            <table className="table-base">
              <thead><tr><th>Mã phiếu</th><th>Sản phẩm</th><th className="text-right">SL (kg)</th><th>Ngày chuyển sang</th><th></th></tr></thead>
              <tbody>
                {mckToRecover.map(t => (
                  <tr key={t.id}>
                    <td className="font-medium">{t.transferCode}</td>
                    <td>{prodName(t.productId)}</td>
                    <td className="text-right">{formatKg(t.qtyKg)}</td>
                    <td>{formatDate(t.transferDate)}</td>
                    <td className="text-right">
                      {canManage && <button className="btn-primary btn-sm" onClick={() => pullBack(t.id)}><RotateCcw className="h-3.5 w-3.5" /> Hút lại → Kho Recover</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {mckToRecover.length === 0 && <EmptyState title="Không có MCK chờ recover" hint={mckInTransit.length ? "Còn phiếu đang trên đường — cần xác nhận nhận ở trang Chuyển kho" : undefined} />}
          </div>

          {/* Kho Recover */}
          <div className="card overflow-x-auto">
            <div className="px-3 py-2 border-b font-semibold text-sm">Kho Recover — hàng đã hút lại, chờ chuyển về Cát Linh</div>
            <table className="table-base">
              <thead><tr><th>Sản phẩm</th><th className="text-right">Tồn recover (kg)</th><th></th></tr></thead>
              <tbody>
                {recoverRows.map(r => (
                  <tr key={r.productId}>
                    <td className="font-medium">{prodName(r.productId)}</td>
                    <td className="text-right font-medium text-emerald-700">{formatKg(r.qtyKg)}</td>
                    <td className="text-right">
                      {canManage && <button className="btn-secondary btn-sm" onClick={() => sendToCl(r.productId)}><Send className="h-3.5 w-3.5" /> Chuyển về Kho Cát Linh</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recoverRows.length === 0 && <EmptyState title="Kho Recover trống" />}
          </div>

          {/* Lịch sử hút lại */}
          <div className="card overflow-x-auto">
            <div className="px-3 py-2 border-b font-semibold text-sm">Lịch sử hút lại</div>
            <table className="table-base">
              <thead><tr><th>Ngày</th><th>Sản phẩm</th><th className="text-right">SL (kg)</th><th>Ngày chuyển sang</th><th>Người ghi</th></tr></thead>
              <tbody>
                {state.recoveryLogs.map(l => (
                  <tr key={l.id}>
                    <td>{formatDate(l.logDate)}</td>
                    <td>{prodName(l.productId)}</td>
                    <td className="text-right text-emerald-700 font-medium">+{formatKg(l.qtyKg)}</td>
                    <td>{l.sentToFactoryDate ? formatDate(l.sentToFactoryDate) : "—"}</td>
                    <td>{state.profiles.find(p => p.id === l.createdBy)?.fullName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {state.recoveryLogs.length === 0 && <EmptyState title="Chưa có hàng recover" />}
          </div>
        </>
      )}

      {tab === "destroy" && (
        <>
          {canManage && <div className="card p-4 grid sm:grid-cols-6 gap-3 items-end">
            <div><label className="label">Ngày</label><input type="date" className="input" value={df.logDate} onChange={e => setDf(f => ({ ...f, logDate: e.target.value }))} /></div>
            <div>
              <label className="label">Kho</label>
              <select className="input" value={df.warehouse} onChange={e => setDf(f => ({ ...f, warehouse: e.target.value as any }))}>
                <option value="factory">Kho Xưởng</option>
                <option value="cl">Kho Cát Linh</option>
              </select>
            </div>
            <div>
              <label className="label">Sản phẩm</label>
              <select className="input" value={df.productId} onChange={e => setDf(f => ({ ...f, productId: e.target.value }))}>
                {state.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className="label">SL (kg)</label><input type="number" step="0.1" className="input" value={df.qtyKg} onChange={e => setDf(f => ({ ...f, qtyKg: Number(e.target.value) }))} /></div>
            <div><label className="label">Lý do</label><input className="input" value={df.reason} onChange={e => setDf(f => ({ ...f, reason: e.target.value }))} /></div>
            <button className="btn-danger" onClick={addDestruction}><Plus className="h-4 w-4" /> Tiêu huỷ</button>
          </div>}
          {canManage && <div className="text-xs text-gray-500 -mt-1">
            Phiếu chi dự kiến: {formatMoney((state.products.find(p => p.id === df.productId)?.fixCost || 0) * (df.qtyKg || 0))} (fix_cost {formatMoney(state.products.find(p => p.id === df.productId)?.fixCost || 0)} × {df.qtyKg || 0} kg)
          </div>}
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Ngày</th><th>Kho</th><th>Sản phẩm</th><th className="text-right">SL (kg)</th><th className="text-right">Fix cost</th><th className="text-right">Phiếu chi</th><th>Lý do</th></tr></thead>
              <tbody>
                {state.destructionLogs.map(l => {
                  const exp = state.expenses.find(e => e.id === l.expenseId);
                  return (
                    <tr key={l.id}>
                      <td>{formatDate(l.logDate)}</td>
                      <td>{l.warehouse === "factory" ? "Xưởng" : "Kho Cát Linh"}</td>
                      <td>{prodName(l.productId)}</td>
                      <td className="text-right text-red-600">−{formatKg(l.qtyKg)}</td>
                      <td className="text-right">{formatMoney(l.unitCost)}</td>
                      <td className="text-right font-medium text-red-600">{formatMoney(l.totalLoss)}<div className="text-xs text-gray-400">{exp?.code}</div></td>
                      <td>{l.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {state.destructionLogs.length === 0 && <EmptyState title="Chưa có hàng tiêu huỷ" />}
          </div>
        </>
      )}
    </div>
  );
}
