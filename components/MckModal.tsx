"use client";
import { useMemo, useState } from "react";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { invQty } from "@/lib/inventory";
import { createMck, revacuumCl, destroyMck, recoverMckToFactory, mckRemaining } from "@/lib/mck-actions";
import { formatDate, formatKg, formatMoney, todayISO } from "@/lib/utils";
import { Filter, RotateCcw, Trash2, Truck } from "lucide-react";

type ActionType = "revacuum" | "destroy" | "recover";

export default function MckModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, update } = useStore();
  const { user } = useAuth();
  // Tiêu huỷ / Recover đều sinh phiếu chi → chỉ ai được tạo phiếu chi mới được xử lý 2 nhánh này.
  // Hút lại tại Cát Linh không phát sinh tiền nên không cần gate này.
  const canFinance = can(user?.role, "manage_expenses");

  const sellableProducts = useMemo(() => state.products.filter(p => p.isActive), [state.products]);
  const [rf, setRf] = useState({ logDate: todayISO(), productId: "", qtyKg: 0, note: "" });
  const [action, setAction] = useState<{ mckId: string; type: ActionType } | null>(null);
  const [aQty, setAQty] = useState(0);
  const [aReason, setAReason] = useState("");
  const [aShip, setAShip] = useState(0);

  const pending = state.mckLogs.filter(m => mckRemaining(m) > 0.001);
  const prodName = (id: string) => state.products.find(p => p.id === id)?.name || "—";

  const addMck = () => {
    if (!rf.productId) { alert("Chọn sản phẩm"); return; }
    const avail = invQty(state.clInventory, rf.productId);
    if (rf.qtyKg <= 0) { alert("Nhập số kg MCK"); return; }
    if (rf.qtyKg > avail) { alert(`Tồn Cát Linh không đủ (còn ${avail} kg).`); return; }
    update(s => createMck(s, rf, user!));
    setRf({ logDate: todayISO(), productId: "", qtyKg: 0, note: "" });
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

  return (
    <Modal open={open} onClose={onClose} title="Lọc hàng — MCK (mất chân không)" size="xl" footer={<button className="btn-secondary" onClick={onClose}>Đóng</button>}>
      <div className="space-y-4">
        <div className="text-xs text-gray-500 flex items-center gap-1"><Filter className="h-3.5 w-3.5" /> Hàng mất chân không trả về Kho Cát Linh. Hút lại được → về bán; không thì Tiêu huỷ hoặc Recover (chuyển về xưởng hút lại).</div>

        {/* Ghi nhận MCK */}
        <div className="card p-3 grid sm:grid-cols-5 gap-3 items-end">
          <div><label className="label">Ngày</label><input type="date" className="input" value={rf.logDate} onChange={e => setRf(f => ({ ...f, logDate: e.target.value }))} /></div>
          <div>
            <label className="label">Sản phẩm</label>
            <select className="input" value={rf.productId} onChange={e => setRf(f => ({ ...f, productId: e.target.value }))}>
              <option value="">— chọn —</option>
              {sellableProducts.map(p => <option key={p.id} value={p.id}>{p.name} — tồn CL {invQty(state.clInventory, p.id)} kg</option>)}
            </select>
          </div>
          <div><label className="label">SL MCK (kg)</label><input type="number" step="0.1" className="input" value={rf.qtyKg || ""} onChange={e => setRf(f => ({ ...f, qtyKg: Number(e.target.value) }))} /></div>
          <div><label className="label">Ghi chú</label><input className="input" value={rf.note} onChange={e => setRf(f => ({ ...f, note: e.target.value }))} /></div>
          <button className="btn-primary" onClick={addMck}><Filter className="h-4 w-4" /> Ghi nhận MCK</button>
        </div>

        {/* Danh sách MCK chờ xử lý */}
        <div className="border border-gray-200 rounded-md overflow-x-auto">
          <div className="px-3 py-2 bg-gray-50 border-b text-sm font-semibold">MCK chờ xử lý tại Cát Linh</div>
          <table className="table-base">
            <thead><tr><th>Mã</th><th>Ngày</th><th>Sản phẩm</th><th className="text-right">Còn lại (kg)</th><th></th></tr></thead>
            <tbody>
              {pending.map(m => (
                <tr key={m.id}>
                  <td className="font-medium">{m.code}</td>
                  <td>{formatDate(m.logDate)}</td>
                  <td>{prodName(m.productId)}</td>
                  <td className="text-right font-medium">{formatKg(mckRemaining(m))}</td>
                  <td className="whitespace-nowrap space-x-1 text-right">
                    <button className="btn-ghost btn-sm text-emerald-700" onClick={() => startAction(m.id, "revacuum")}><RotateCcw className="h-3.5 w-3.5" /> Hút lại</button>
                    {canFinance && <button className="btn-ghost btn-sm text-red-600" onClick={() => startAction(m.id, "destroy")}><Trash2 className="h-3.5 w-3.5" /> Tiêu huỷ</button>}
                    {canFinance && <button className="btn-ghost btn-sm text-blue-700" onClick={() => startAction(m.id, "recover")}><Truck className="h-3.5 w-3.5" /> Recover</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pending.length === 0 && <EmptyState title="Không có hàng MCK chờ xử lý" />}
        </div>

        {/* Panel xử lý */}
        {action && (() => {
          const m = state.mckLogs.find(x => x.id === action.mckId)!;
          const title = action.type === "revacuum" ? "Hút lại tại Cát Linh → về tồn bán được"
            : action.type === "destroy" ? "Tiêu huỷ → sinh phiếu chi (fix_cost × SL)"
            : "Recover → chuyển về xưởng hút lại (phí ship sinh phiếu chi)";
          const prod = state.products.find(p => p.id === m.productId);
          return (
            <div className="border border-brand-200 bg-brand-50/30 rounded-md p-3 space-y-3">
              <div className="text-sm font-semibold text-gray-700">{title} — {prodName(m.productId)} (còn {formatKg(mckRemaining(m))})</div>
              <div className="grid sm:grid-cols-3 gap-3 items-end">
                <div><label className="label">Số lượng (kg)</label><input type="number" step="0.1" className="input" value={aQty || ""} onChange={e => setAQty(Number(e.target.value))} /></div>
                {action.type === "destroy" && (
                  <>
                    <div><label className="label">Lý do</label><input className="input" value={aReason} onChange={e => setAReason(e.target.value)} /></div>
                    <div className="text-sm text-gray-600">Phiếu chi dự kiến: <b>{formatMoney((prod?.fixCost || 0) * (aQty || 0))}</b></div>
                  </>
                )}
                {action.type === "recover" && (
                  <div><label className="label">Phí ship về xưởng (đ)</label><input type="number" className="input" value={aShip || ""} onChange={e => setAShip(Number(e.target.value))} /></div>
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
