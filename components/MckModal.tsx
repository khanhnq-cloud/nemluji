"use client";
import { useMemo, useState } from "react";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { invQty } from "@/lib/inventory";
import { createMck, destroyFromCl, revacuumCl, destroyMck, recoverMckToFactory, mckRemaining, mckSourceOf } from "@/lib/mck-actions";
import { formatDate, formatKg, formatMoney, todayISO } from "@/lib/utils";
import { Filter, RotateCcw, Trash2, Truck } from "lucide-react";
import type { MckLog } from "@/types";

type ActionType = "revacuum" | "destroy" | "recover";
// Tình trạng hàng khi lọc
type FilterKind = "destroy" | "mck" | "return";

const KIND_OPTIONS: { value: FilterKind; label: string; hint: string }[] = [
  { value: "destroy", label: "Tiêu huỷ", hint: "Trừ thẳng vào tồn Kho Cát Linh, sinh phiếu chi theo giá vốn." },
  { value: "mck", label: "MCK (mất chân không)", hint: "Trừ tồn bán được, cộng vào mục hàng MCK chờ mang sang xưởng hút lại." },
  { value: "return", label: "Hàng đổi về", hint: "Hàng khách đổi trả: cộng vào mục hàng đổi về cần test và mang sang xưởng hút lại (không trừ tồn)." },
];

const blankForm = () => ({ logDate: todayISO(), productId: "", qtyKg: 0, kind: "mck" as FilterKind, note: "" });

export default function MckModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, update } = useStore();
  const { user } = useAuth();
  // Tiêu huỷ / chuyển xưởng đều sinh phiếu chi → chỉ ai được tạo phiếu chi mới được xử lý 2 nhánh này.
  // Hút lại / test đạt tại Cát Linh không phát sinh tiền nên không cần gate này.
  const canFinance = can(user?.role, "manage_expenses");
  const showFin = can(user?.role, "view_financials"); // fix_cost — chỉ admin

  const sellableProducts = useMemo(() => state.products.filter(p => p.isActive), [state.products]);
  const [rf, setRf] = useState(blankForm);
  const [action, setAction] = useState<{ mckId: string; type: ActionType } | null>(null);
  const [aQty, setAQty] = useState(0);
  const [aReason, setAReason] = useState("");
  const [aShip, setAShip] = useState(0);

  const pending = state.mckLogs.filter(m => mckRemaining(m) > 0.001);
  const pendingMck = pending.filter(m => mckSourceOf(m) === "mck");
  const pendingReturn = pending.filter(m => mckSourceOf(m) === "return");
  const totalOf = (rows: MckLog[]) => rows.reduce((sum, m) => sum + mckRemaining(m), 0);
  const prodName = (id: string) => state.products.find(p => p.id === id)?.name || "—";
  const selectedProduct = state.products.find(p => p.id === rf.productId);
  const kindHint = KIND_OPTIONS.find(k => k.value === rf.kind)?.hint;

  const submit = () => {
    if (!user) return;
    if (!rf.logDate) { alert("Chọn ngày"); return; }
    if (rf.logDate > todayISO()) { alert("Ngày không được ở tương lai"); return; }
    if (!rf.productId) { alert("Chọn loại hàng"); return; }
    if (!(rf.qtyKg > 0)) { alert("Nhập số lượng"); return; }
    const avail = invQty(state.clInventory, rf.productId);
    if (rf.kind !== "return" && rf.qtyKg > avail) { alert(`Tồn Cát Linh không đủ (còn ${avail} kg).`); return; }
    if (rf.kind === "destroy") {
      if (!canFinance) { alert("Tài khoản không có quyền tạo phiếu chi tiêu huỷ."); return; }
      if (!confirm(`Tiêu huỷ ${rf.qtyKg} kg ${selectedProduct?.name}? Tồn Kho Cát Linh sẽ bị trừ.`)) return;
      update(s => destroyFromCl(s, { logDate: rf.logDate, productId: rf.productId, qtyKg: rf.qtyKg, reason: rf.note }, user));
    } else {
      update(s => createMck(s, { logDate: rf.logDate, productId: rf.productId, qtyKg: rf.qtyKg, note: rf.note, source: rf.kind === "return" ? "return" : "mck" }, user));
    }
    setRf(current => ({ ...blankForm(), logDate: current.logDate, kind: current.kind }));
  };

  const startAction = (mckId: string, type: ActionType) => {
    const m = state.mckLogs.find(x => x.id === mckId);
    setAction({ mckId, type });
    setAQty(m ? mckRemaining(m) : 0);
    setAReason("");
    setAShip(0);
  };

  const confirmAction = () => {
    if (!action) return;
    if ((action.type === "destroy" || action.type === "recover") && !canFinance) return;
    const m = state.mckLogs.find(x => x.id === action.mckId);
    if (!m) return;
    if (aQty <= 0 || aQty > mckRemaining(m)) { alert("Số lượng không hợp lệ"); return; }
    if (action.type === "revacuum") update(s => revacuumCl(s, action.mckId, aQty));
    if (action.type === "destroy") update(s => destroyMck(s, action.mckId, aQty, aReason, user!));
    if (action.type === "recover") update(s => recoverMckToFactory(s, action.mckId, aQty, aShip, user!));
    setAction(null);
  };

  const renderTable = (title: string, rows: MckLog[], isReturn: boolean) => (
    <div className="border border-gray-200 rounded-md overflow-x-auto">
      <div className="px-3 py-2 bg-gray-50 border-b text-sm font-semibold flex items-center justify-between gap-3">
        <span>{title}</span>
        <span className="text-gray-700">{formatKg(totalOf(rows))}</span>
      </div>
      <table className="table-base">
        <thead><tr><th>Mã</th><th>Ngày</th><th>Loại hàng</th><th className="text-right">Còn lại (kg)</th><th>Ghi chú</th><th></th></tr></thead>
        <tbody>
          {rows.map(m => (
            <tr key={m.id}>
              <td className="font-medium">{m.code}</td>
              <td>{formatDate(m.logDate)}</td>
              <td>{prodName(m.productId)}</td>
              <td className="text-right font-medium">{formatKg(mckRemaining(m))}</td>
              <td className="text-xs text-gray-500 max-w-40 truncate" title={m.note}>{m.note || ""}</td>
              <td className="whitespace-nowrap space-x-1 text-right">
                <button className="btn-ghost btn-sm text-emerald-700" onClick={() => startAction(m.id, "revacuum")} title="Trả về tồn bán được">
                  <RotateCcw className="h-3.5 w-3.5" /> {isReturn ? "Test đạt" : "Hút lại"}
                </button>
                {canFinance && <button className="btn-ghost btn-sm text-blue-700" onClick={() => startAction(m.id, "recover")}><Truck className="h-3.5 w-3.5" /> Sang xưởng</button>}
                {canFinance && <button className="btn-ghost btn-sm text-red-600" onClick={() => startAction(m.id, "destroy")}><Trash2 className="h-3.5 w-3.5" /> Tiêu huỷ</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <EmptyState title={isReturn ? "Không có hàng đổi về chờ xử lý" : "Không có hàng MCK chờ xử lý"} />}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Lọc hàng — Kho Cát Linh" size="xl" footer={<button className="btn-secondary" onClick={onClose}>Đóng</button>}>
      <div className="space-y-4">
        {/* Ghi nhận lọc hàng: Ngày + Loại hàng + Số lượng + Tình trạng */}
        <div className="card p-3 space-y-3">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div><label className="label">Ngày *</label><input type="date" className="input" value={rf.logDate} max={todayISO()} onChange={e => setRf(f => ({ ...f, logDate: e.target.value }))} /></div>
            <div>
              <label className="label">Loại hàng *</label>
              <select className="input" value={rf.productId} onChange={e => setRf(f => ({ ...f, productId: e.target.value }))}>
                <option value="">— chọn —</option>
                {sellableProducts.map(p => <option key={p.id} value={p.id}>{p.name} — tồn CL {invQty(state.clInventory, p.id)} kg</option>)}
              </select>
            </div>
            <div><label className="label">Số lượng (kg) *</label><input type="number" min="0" step="0.1" className="input" placeholder="0" value={rf.qtyKg || ""} onChange={e => setRf(f => ({ ...f, qtyKg: Number(e.target.value || 0) }))} /></div>
            <div>
              <label className="label">Tình trạng hàng *</label>
              <select className="input" value={rf.kind} onChange={e => setRf(f => ({ ...f, kind: e.target.value as FilterKind }))}>
                {KIND_OPTIONS.map(k => (
                  <option key={k.value} value={k.value} disabled={k.value === "destroy" && !canFinance}>
                    {k.label}{k.value === "destroy" && !canFinance ? " (cần quyền phiếu chi)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div><label className="label">{rf.kind === "destroy" ? "Lý do tiêu huỷ" : "Ghi chú"}</label><input className="input" value={rf.note} onChange={e => setRf(f => ({ ...f, note: e.target.value }))} /></div>
            <button className="btn-primary" onClick={submit}><Filter className="h-4 w-4" /> Ghi nhận</button>
          </div>
          <div className="text-xs text-gray-500">
            {kindHint}
            {rf.kind === "destroy" && showFin && selectedProduct && rf.qtyKg > 0 && <> Phiếu chi dự kiến: <b>{formatMoney(selectedProduct.fixCost * rf.qtyKg)}</b>.</>}
          </div>
        </div>

        {renderTable("Hàng MCK — chờ mang sang xưởng hút lại", pendingMck, false)}
        {renderTable("Hàng đổi về — cần test và mang sang xưởng hút lại", pendingReturn, true)}

        {/* Panel xử lý */}
        {action && (() => {
          const m = state.mckLogs.find(x => x.id === action.mckId);
          if (!m) return null;
          const isReturn = mckSourceOf(m) === "return";
          const title = action.type === "revacuum" ? (isReturn ? "Test đạt → về tồn bán được" : "Hút lại tại Cát Linh → về tồn bán được")
            : action.type === "destroy" ? "Tiêu huỷ → sinh phiếu chi (fix_cost × SL)"
            : "Chuyển sang xưởng hút lại (phí ship sinh phiếu chi)";
          const prod = state.products.find(p => p.id === m.productId);
          return (
            <div className="border border-brand-200 bg-brand-50/30 rounded-md p-3 space-y-3">
              <div className="text-sm font-semibold text-gray-700">{title} — {m.code} {prodName(m.productId)} (còn {formatKg(mckRemaining(m))})</div>
              <div className="grid sm:grid-cols-3 gap-3 items-end">
                <div><label className="label">Số lượng (kg)</label><input type="number" step="0.1" className="input" value={aQty || ""} onChange={e => setAQty(Number(e.target.value || 0))} /></div>
                {action.type === "destroy" && (
                  <>
                    <div><label className="label">Lý do</label><input className="input" value={aReason} onChange={e => setAReason(e.target.value)} /></div>
                    {showFin && <div className="text-sm text-gray-600">Phiếu chi dự kiến: <b>{formatMoney((prod?.fixCost || 0) * (aQty || 0))}</b></div>}
                  </>
                )}
                {action.type === "recover" && (
                  <div><label className="label">Phí ship về xưởng (đ)</label><input type="number" className="input" placeholder="0" value={aShip || ""} onChange={e => setAShip(Number(e.target.value || 0))} /></div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => setAction(null)}>Huỷ</button>
                <button className="btn-primary" onClick={confirmAction}>Xác nhận</button>
              </div>
            </div>
          );
        })()}
      </div>
    </Modal>
  );
}
