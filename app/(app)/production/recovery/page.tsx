"use client";
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { adjustInventory, invQty } from "@/lib/inventory";
import { formatDate, formatKg, formatMoney, nextSequentialCode, newId, todayISO } from "@/lib/utils";
import { Plus, RotateCcw } from "lucide-react";
import type { RecoveryLog, DestructionLog, Expense } from "@/types";

export default function RecoveryPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const [tab, setTab] = useState<"recover" | "destroy">("recover");

  const [rf, setRf] = useState({ logDate: todayISO(), productId: state.products[0]?.id || "", qtyKg: 0, note: "" });
  const [df, setDf] = useState({ logDate: todayISO(), productId: state.products[0]?.id || "", warehouse: "factory" as "factory" | "cl", qtyKg: 0, reason: "" });

  // Recover: hút chân không → quay lại tồn kho XƯỞNG (không cộng chi phí)
  const addRecovery = () => {
    if (rf.qtyKg <= 0) { alert("Nhập kg recover"); return; }
    const log: RecoveryLog = { id: newId(), logDate: rf.logDate, productId: rf.productId, qtyKg: rf.qtyKg, note: rf.note, createdBy: user!.id };
    update(s => ({
      ...s,
      recoveryLogs: [log, ...s.recoveryLogs],
      factoryInventory: adjustInventory(s.factoryInventory, rf.productId, rf.qtyKg), // về tồn kho xưởng
    }));
    setRf({ logDate: todayISO(), productId: state.products[0]?.id || "", qtyKg: 0, note: "" });
  };

  // Tiêu huỷ: trừ tồn (chọn kho) + tạo PHIẾU CHI = fix_cost × số lượng
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
  const totalRecovered = state.recoveryLogs.reduce((s, l) => s + l.qtyKg, 0);
  const prodName = (id: string) => state.products.find(p => p.id === id)?.name || "—";

  return (
    <div className="space-y-4">
      <PageHeader title="Hàng recover / tiêu huỷ" subtitle="Recover → hút chân không → về tồn kho Xưởng (không cộng chi phí) • Tiêu huỷ → trừ tồn + tạo phiếu chi (fix_cost × SL)" />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Tổng recover (về Xưởng)" value={formatKg(totalRecovered)} tone="good" />
        <StatCard label="Phiếu chi tiêu huỷ" value={state.expenses.filter(e => e.type === "destruction").length} />
        <StatCard label="Tổng chi tiêu huỷ" value={formatMoney(totalDestroyExpense)} tone={totalDestroyExpense ? "bad" : "default"} />
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {[{ k: "recover", label: "Hàng recover → Xưởng" }, { k: "destroy", label: "Hàng tiêu huỷ → Phiếu chi" }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.k ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "recover" && (
        <>
          <div className="card p-4 grid sm:grid-cols-5 gap-3 items-end">
            <div><label className="label">Ngày</label><input type="date" className="input" value={rf.logDate} onChange={e => setRf(f => ({ ...f, logDate: e.target.value }))} /></div>
            <div>
              <label className="label">Sản phẩm</label>
              <select className="input" value={rf.productId} onChange={e => setRf(f => ({ ...f, productId: e.target.value }))}>
                {state.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className="label">SL recover (kg)</label><input type="number" step="0.1" className="input" value={rf.qtyKg} onChange={e => setRf(f => ({ ...f, qtyKg: Number(e.target.value) }))} /></div>
            <div><label className="label">Ghi chú</label><input className="input" value={rf.note} onChange={e => setRf(f => ({ ...f, note: e.target.value }))} /></div>
            <button className="btn-primary" onClick={addRecovery}><RotateCcw className="h-4 w-4" /> Hút lại → Xưởng</button>
          </div>
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Ngày</th><th>Sản phẩm</th><th className="text-right">SL recover (kg)</th><th>Ghi chú</th><th>Người ghi</th></tr></thead>
              <tbody>
                {state.recoveryLogs.map(l => (
                  <tr key={l.id}>
                    <td>{formatDate(l.logDate)}</td>
                    <td>{prodName(l.productId)}</td>
                    <td className="text-right text-emerald-700 font-medium">+{formatKg(l.qtyKg)}</td>
                    <td>{l.note}</td>
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
          <div className="card p-4 grid sm:grid-cols-6 gap-3 items-end">
            <div><label className="label">Ngày</label><input type="date" className="input" value={df.logDate} onChange={e => setDf(f => ({ ...f, logDate: e.target.value }))} /></div>
            <div>
              <label className="label">Kho</label>
              <select className="input" value={df.warehouse} onChange={e => setDf(f => ({ ...f, warehouse: e.target.value as any }))}>
                <option value="factory">Kho Xưởng</option>
                <option value="cl">Kho CL (HN)</option>
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
          </div>
          <div className="text-xs text-gray-500 -mt-1">
            Phiếu chi dự kiến: {formatMoney((state.products.find(p => p.id === df.productId)?.fixCost || 0) * (df.qtyKg || 0))} (fix_cost {formatMoney(state.products.find(p => p.id === df.productId)?.fixCost || 0)} × {df.qtyKg || 0} kg)
          </div>
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Ngày</th><th>Kho</th><th>Sản phẩm</th><th className="text-right">SL (kg)</th><th className="text-right">Fix cost</th><th className="text-right">Phiếu chi</th><th>Lý do</th></tr></thead>
              <tbody>
                {state.destructionLogs.map(l => {
                  const exp = state.expenses.find(e => e.id === l.expenseId);
                  return (
                    <tr key={l.id}>
                      <td>{formatDate(l.logDate)}</td>
                      <td>{l.warehouse === "factory" ? "Xưởng" : "Kho CL"}</td>
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
