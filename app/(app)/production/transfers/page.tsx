"use client";
import { useState } from "react";
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
import type { StockTransfer } from "@/types";

export default function TransfersPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ transferDate: string; productId: string; qtyKg: number; note?: string }>({
    transferDate: todayISO(), productId: state.products[0]?.id || "", qtyKg: 0,
  });

  const create = () => {
    if (form.qtyKg <= 0) { alert("Nhập số kg chuyển"); return; }
    const avail = invQty(state.factoryInventory, form.productId);
    if (form.qtyKg > avail) { alert(`Tồn kho Xưởng không đủ (còn ${avail} kg). Cần sản xuất thêm.`); return; }
    const t: StockTransfer = {
      id: newId(), transferCode: nextSequentialCode("TR", state.transfers.map(t => t.transferCode)), transferDate: form.transferDate,
      productId: form.productId, qtyKg: form.qtyKg, status: "pending", note: form.note,
    };
    // Hàng rời Xưởng ngay khi tạo phiếu (đang trên đường) — trừ tồn kho Xưởng
    update(s => ({
      ...s,
      transfers: [t, ...s.transfers],
      factoryInventory: adjustInventory(s.factoryInventory, form.productId, -form.qtyKg),
    }));
    setOpen(false); setForm({ transferDate: todayISO(), productId: state.products[0]?.id || "", qtyKg: 0 });
  };

  const confirmReceive = (id: string) => {
    update(s => {
      const t = s.transfers.find(x => x.id === id);
      if (!t) return s;
      const transfers = s.transfers.map(x => x.id === id ? { ...x, status: "received" as const, receivedBy: user!.id, receivedAt: todayISO() } : x);
      // Kho HN nhận → cộng tồn kho CL (Rule 5 mục 8.5.4)
      const clInventory = adjustInventory(s.clInventory, t.productId, t.qtyKg);
      return { ...s, transfers, clInventory };
    });
  };

  const cancelTransfer = (id: string) => {
    if (!confirm("Huỷ phiếu chuyển? Hàng sẽ hoàn lại tồn kho Xưởng.")) return;
    update(s => {
      const t = s.transfers.find(x => x.id === id);
      if (!t || t.status !== "pending") return s;
      return {
        ...s,
        transfers: s.transfers.map(x => x.id === id ? { ...x, status: "cancelled" as const } : x),
        factoryInventory: adjustInventory(s.factoryInventory, t.productId, t.qtyKg),
      };
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chuyển kho (Đông Anh → Hà Nội)"
        subtitle="Kho HN bấm 'Xác nhận đã nhận' mới cộng vào tồn kho CL"
        actions={can(user?.role, "create_transfer") && <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Tạo phiếu chuyển</button>}
      />

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Mã</th><th>Ngày</th><th>Sản phẩm</th><th className="text-right">SL (kg)</th><th>Trạng thái</th><th>Người nhận</th><th></th></tr></thead>
          <tbody>
            {state.transfers.map(t => {
              const p = state.products.find(x => x.id === t.productId);
              const receiver = state.profiles.find(x => x.id === t.receivedBy);
              return (
                <tr key={t.id}>
                  <td className="font-medium">{t.transferCode}</td>
                  <td>{formatDate(t.transferDate)}</td>
                  <td>{p?.name || "—"}</td>
                  <td className="text-right">{formatKg(t.qtyKg)}</td>
                  <td><TransferBadge status={t.status} /></td>
                  <td>{receiver?.fullName || "—"}</td>
                  <td className="whitespace-nowrap space-x-1">
                    {t.status === "pending" && can(user?.role, "confirm_transfer") && (
                      <button className="btn-primary btn-sm" onClick={() => confirmReceive(t.id)}><PackageCheck className="h-3.5 w-3.5" /> Xác nhận đã nhận</button>
                    )}
                    {t.status === "pending" && can(user?.role, "create_transfer") && (
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
              {state.products.map(p => <option key={p.id} value={p.id}>{p.name} — tồn xưởng {invQty(state.factoryInventory, p.id)} kg</option>)}
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
