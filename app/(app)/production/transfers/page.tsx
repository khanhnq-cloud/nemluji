"use client";
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { TransferBadge } from "@/components/Badge";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDate, formatKg, nextSequentialCode, newId, todayISO } from "@/lib/utils";
import { adjustInventory, invQty } from "@/lib/inventory";
import { Plus, PackageCheck } from "lucide-react";
import type { StockTransfer, TransferDirection } from "@/types";

const DIRECTION_LABEL: Record<TransferDirection, string> = {
  factory_to_cl: "Xưởng → Cát Linh",
  cl_to_factory: "Cát Linh → Xưởng (MCK)",
  recover_to_cl: "Recover → Cát Linh",
};

export default function TransfersPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const canCreate = can(user?.role, "create_transfer");
  const canConfirmCl = can(user?.role, "confirm_transfer");
  const canConfirmFactory = can(user?.role, "confirm_transfer_factory");
  const canManageRecovery = can(user?.role, "manage_recovery");
  const canManageExpenses = can(user?.role, "manage_expenses");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ transferDate: string; productId: string; qtyKg: number; note?: string }>({
    transferDate: todayISO(), productId: "", qtyKg: 0,
  });

  const outputProducts = useMemo(() => state.products.filter(p => p.isActive && p.isFactoryOutput), [state.products]);

  const openCreate = (productId?: string) => {
    setForm({ transferDate: todayISO(), productId: productId || outputProducts[0]?.id || "", qtyKg: 0 });
    setOpen(true);
  };

  const create = () => {
    if (!form.productId) { alert("Chọn sản phẩm"); return; }
    if (form.qtyKg <= 0) { alert("Nhập số kg chuyển"); return; }
    const avail = invQty(state.factoryInventory, form.productId);
    if (form.qtyKg > avail) { alert(`Tồn kho Xưởng không đủ (còn ${avail} kg). Cần sản xuất thêm.`); return; }
    const t: StockTransfer = {
      id: newId(), transferCode: nextSequentialCode("TR", state.transfers.map(t => t.transferCode)), transferDate: form.transferDate,
      productId: form.productId, qtyKg: form.qtyKg, status: "pending", note: form.note, direction: "factory_to_cl",
    };
    // Hàng rời Xưởng ngay khi tạo phiếu — trừ tồn kho Xưởng
    update(s => ({
      ...s,
      transfers: [t, ...s.transfers],
      factoryInventory: adjustInventory(s.factoryInventory, form.productId, -form.qtyKg),
    }));
    setOpen(false); setForm({ transferDate: todayISO(), productId: "", qtyKg: 0 });
  };

  const confirmReceive = (id: string) => {
    update(s => {
      const t = s.transfers.find(x => x.id === id);
      if (!t) return s;
      const dir = t.direction || "factory_to_cl";
      const transfers = s.transfers.map(x => x.id === id ? { ...x, status: "received" as const, receivedBy: user!.id, receivedAt: todayISO() } : x);
      // factory_to_cl và recover_to_cl → cộng tồn Kho Cát Linh (hàng bán được)
      // cl_to_factory (MCK) → không cộng tồn xưởng; recover page xử lý hút lại
      if (dir === "factory_to_cl" || dir === "recover_to_cl") {
        return { ...s, transfers, clInventory: adjustInventory(s.clInventory, t.productId, t.qtyKg) };
      }
      // MCK về xưởng đã nhận → hiện trong "MCK cần recover" (recovery page lọc theo status received)
      return { ...s, transfers };
    });
  };

  // Huỷ phiếu chờ nhận — hoàn tồn kho nguồn + hoàn bút toán liên quan theo từng chiều
  const cancelTransfer = (id: string) => {
    const t = state.transfers.find(x => x.id === id);
    if (!t || t.status !== "pending") return;
    if (!confirm("Huỷ phiếu chuyển? Hàng và các bút toán liên quan (nếu có) sẽ được hoàn lại.")) return;
    update(s => {
      const cur = s.transfers.find(x => x.id === id);
      if (!cur || cur.status !== "pending") return s;
      const dir = cur.direction || "factory_to_cl";
      const transfers = s.transfers.map(x => x.id === id ? { ...x, status: "cancelled" as const } : x);
      if (dir === "factory_to_cl") {
        return { ...s, transfers, factoryInventory: adjustInventory(s.factoryInventory, cur.productId, cur.qtyKg) };
      }
      if (dir === "recover_to_cl") {
        return { ...s, transfers, recoverInventory: adjustInventory(s.recoverInventory, cur.productId, cur.qtyKg) };
      }
      // cl_to_factory (MCK) → hoàn tồn Cát Linh, lùi trạng thái MCK, huỷ phiếu chi ship nếu có
      const mckLogs = cur.mckLogId
        ? s.mckLogs.map(m => m.id === cur.mckLogId
            ? { ...m, resolvedQty: Math.max(0, +((m.resolvedQty || 0) - cur.qtyKg).toFixed(2)), status: "pending" as const }
            : m)
        : s.mckLogs;
      const expenses = cur.expenseId ? s.expenses.filter(e => e.id !== cur.expenseId) : s.expenses;
      return { ...s, transfers, clInventory: adjustInventory(s.clInventory, cur.productId, cur.qtyKg), mckLogs, expenses };
    });
  };

  const canCancel = (dir: TransferDirection) =>
    dir === "factory_to_cl" ? canCreate : dir === "recover_to_cl" ? canManageRecovery : canManageExpenses;

  const pendingFactoryToCl = state.transfers.filter(t => t.status === "pending" && (t.direction || "factory_to_cl") === "factory_to_cl").length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chuyển kho (Xưởng → Cát Linh)"
        subtitle="Tạo phiếu theo tồn từng loại • Bên nhận (Cát Linh hoặc Xưởng, theo chiều) bấm 'Xác nhận đã nhận' mới cộng tồn"
        actions={canCreate && <button className="btn-primary" onClick={() => openCreate()}><Plus className="h-4 w-4" /> Tạo phiếu chuyển</button>}
      />

      {/* Tồn Kho Xưởng theo loại + nút tạo phiếu ngay dòng */}
      <div className="card overflow-x-auto">
        <div className="px-3 py-2 border-b font-semibold text-sm">Tồn Kho Xưởng theo loại</div>
        <table className="table-base">
          <thead><tr><th>Thành phẩm</th><th className="text-right">Tồn xưởng (kg)</th>{canCreate && <th></th>}</tr></thead>
          <tbody>
            {outputProducts.map(p => {
              const q = invQty(state.factoryInventory, p.id);
              return (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td className={`text-right font-medium ${q <= 0 ? "text-gray-400" : "text-gray-900"}`}>{formatKg(q)}</td>
                  {canCreate && (
                    <td className="text-right">
                      <button className="btn-secondary btn-sm" disabled={q <= 0} onClick={() => openCreate(p.id)}>
                        <Plus className="h-3.5 w-3.5" /> Tạo phiếu chuyển
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <div className="px-3 py-2 border-b font-semibold text-sm flex items-center justify-between">
          <span>Phiếu chuyển kho</span>
          {pendingFactoryToCl > 0 && <span className="badge-yellow">{pendingFactoryToCl} phiếu đang trên đường</span>}
        </div>
        <table className="table-base">
          <thead><tr><th>Mã</th><th>Ngày</th><th>Chiều</th><th>Sản phẩm</th><th className="text-right">SL (kg)</th><th>Trạng thái</th><th>Người nhận</th><th></th></tr></thead>
          <tbody>
            {state.transfers.map(t => {
              const p = state.products.find(x => x.id === t.productId);
              const receiver = state.profiles.find(x => x.id === t.receivedBy);
              const dir = t.direction || "factory_to_cl";
              return (
                <tr key={t.id}>
                  <td className="font-medium">{t.transferCode}</td>
                  <td>{formatDate(t.transferDate)}</td>
                  <td className="whitespace-nowrap text-xs">{DIRECTION_LABEL[dir]}</td>
                  <td>{p?.name || "—"}</td>
                  <td className="text-right">{formatKg(t.qtyKg)}</td>
                  <td><TransferBadge status={t.status} /></td>
                  <td>{receiver?.fullName || "—"}</td>
                  <td className="whitespace-nowrap space-x-1">
                    {t.status === "pending" && (dir === "cl_to_factory" ? canConfirmFactory : canConfirmCl) && (
                      <button className="btn-primary btn-sm" onClick={() => confirmReceive(t.id)}><PackageCheck className="h-3.5 w-3.5" /> Xác nhận đã nhận</button>
                    )}
                    {t.status === "pending" && canCancel(dir) && (
                      <button className="btn-ghost btn-sm text-red-600" onClick={() => cancelTransfer(t.id)}>Huỷ</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {state.transfers.length === 0 && <EmptyState />}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Tạo phiếu chuyển kho" size="sm" footer={
        <>
          <button className="btn-secondary" onClick={() => setOpen(false)}>Huỷ</button>
          <button className="btn-primary" onClick={create}>Tạo phiếu</button>
        </>
      }>
        <div className="space-y-3">
          <div><label className="label">Ngày chuyển</label><input type="date" className="input" value={form.transferDate} onChange={e => setForm(f => ({ ...f, transferDate: e.target.value }))} /></div>
          <div>
            <label className="label">Sản phẩm</label>
            <select className="input" value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}>
              <option value="">— chọn —</option>
              {outputProducts.map(p => <option key={p.id} value={p.id}>{p.name} — tồn xưởng {invQty(state.factoryInventory, p.id)} kg</option>)}
            </select>
          </div>
          <div>
            <label className="label">Số kg (tồn xưởng: {invQty(state.factoryInventory, form.productId)} kg)</label>
            <input type="number" step="0.1" className="input" value={form.qtyKg} onChange={e => setForm(f => ({ ...f, qtyKg: Number(e.target.value) }))} />
          </div>
          <div><label className="label">Ghi chú</label><input className="input" value={form.note || ""} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}
