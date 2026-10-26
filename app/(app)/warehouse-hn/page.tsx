"use client";
import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import { TransferBadge } from "@/components/Badge";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { adjustInventory, invQty, totalQty } from "@/lib/inventory";
import { formatDate, formatKg, formatMoney } from "@/lib/utils";

export default function WarehouseHnPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const canAdjust = can(user?.role, "adjust_inventory"); // chỉ admin

  const [editId, setEditId] = useState<string | null>(null);
  const [fac, setFac] = useState("");
  const [cl, setCl] = useState("");
  const editing = state.products.find(p => p.id === editId);

  const openEdit = (productId: string) => {
    setFac(String(invQty(state.factoryInventory, productId)));
    setCl(String(invQty(state.clInventory, productId)));
    setEditId(productId);
  };

  const facNum = Number(fac);
  const clNum = Number(cl);
  const valid = fac.trim() !== "" && cl.trim() !== "" && Number.isFinite(facNum) && Number.isFinite(clNum) && facNum >= 0 && clNum >= 0;

  const saveEdit = () => {
    if (!editId || !valid || !canAdjust) return;
    update(s => ({
      ...s,
      factoryInventory: adjustInventory(s.factoryInventory, editId, facNum - invQty(s.factoryInventory, editId)),
      clInventory: adjustInventory(s.clInventory, editId, clNum - invQty(s.clInventory, editId)),
    }));
    setEditId(null);
  };

  const clValue = useMemo(
    () => state.clInventory.reduce((s, ci) => {
      const p = state.products.find(x => x.id === ci.productId);
      return s + ci.qtyKg * (p?.fixCost || 0);
    }, 0),
    [state.clInventory, state.products]
  );

  const pendingTransfers = state.transfers.filter(t => t.status === "pending");

  return (
    <div className="space-y-4">
      <PageHeader title="Kho thành phẩm — Xưởng ↔ Cát Linh" subtitle="Tồn 2 kho liên kết: Sản xuất → Xưởng → (chuyển kho) → Cát Linh → (bán hàng) trừ Cát Linh" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Tồn kho Xưởng (kg)" value={formatKg(totalQty(state.factoryInventory))} />
        <StatCard label="Tồn kho Cát Linh (kg)" value={formatKg(totalQty(state.clInventory))} />
        <StatCard label="Giá trị tồn Cát Linh" value={formatMoney(clValue)} />
        <StatCard label="Phiếu chuyển chờ nhận" value={pendingTransfers.length} tone={pendingTransfers.length ? "warn" : "default"} />
      </div>

      <div className="card overflow-x-auto">
        <div className="px-3 py-2 border-b font-semibold text-sm">Tồn kho thành phẩm 2 kho (liên kết)</div>
        <table className="table-base">
          <thead><tr>
            <th>Sản phẩm</th><th>Đơn vị</th>
            <th className="text-right">Tồn Xưởng</th>
            <th className="text-right">Tồn Cát Linh</th>
            <th className="text-right">Tổng tồn</th>
            <th className="text-right">Giá vốn/kg</th><th className="text-right">Giá trị tồn Cát Linh</th>
            {canAdjust && <th />}
          </tr></thead>
          <tbody>
            {state.products.map(p => {
              const fac = invQty(state.factoryInventory, p.id);
              const cl = invQty(state.clInventory, p.id);
              return (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.unit}</td>
                  <td className="text-right">{formatKg(fac)}</td>
                  <td className={`text-right ${cl < 5 ? "text-red-600 font-medium" : ""}`}>{formatKg(cl)}</td>
                  <td className="text-right font-medium">{formatKg(fac + cl)}</td>
                  <td className="text-right">{formatMoney(p.fixCost)}</td>
                  <td className="text-right">{formatMoney(cl * p.fixCost)}</td>
                  {canAdjust && (
                    <td className="text-right">
                      <button className="btn-ghost btn-sm" onClick={() => openEdit(p.id)} title="Chỉnh tồn kho">
                        <Pencil className="h-3.5 w-3.5" /> Chỉnh tồn
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
        <div className="px-3 py-2 border-b font-semibold text-sm">Phiếu nhập kho từ xưởng</div>
        <table className="table-base">
          <thead><tr><th>Mã</th><th>Ngày</th><th>Sản phẩm</th><th className="text-right">SL (kg)</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {state.transfers.map(t => (
              <tr key={t.id}>
                <td className="font-medium">{t.transferCode}</td>
                <td>{formatDate(t.transferDate)}</td>
                <td>{state.products.find(p => p.id === t.productId)?.name || "—"}</td>
                <td className="text-right">{formatKg(t.qtyKg)}</td>
                <td><TransferBadge status={t.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {state.transfers.length === 0 && <EmptyState />}
      </div>

      <Modal
        open={canAdjust && !!editing}
        onClose={() => setEditId(null)}
        title={`Chỉnh tồn kho — ${editing?.name ?? ""}`}
        size="sm"
        footer={<>
          <button className="btn-secondary" onClick={() => setEditId(null)}>Huỷ</button>
          <button className="btn-primary" disabled={!valid} onClick={saveEdit}>Lưu</button>
        </>}
      >
        <div className="space-y-3">
          <div className="text-xs text-gray-500">Nhập số tồn thực tế (kg). Giá trị mới sẽ thay thế số tồn hiện tại.</div>
          <div>
            <label className="label">Tồn Xưởng (kg)</label>
            <input className="input" type="number" min={0} step="0.01" value={fac} onChange={e => setFac(e.target.value)} />
          </div>
          <div>
            <label className="label">Tồn Cát Linh (kg)</label>
            <input className="input" type="number" min={0} step="0.01" value={cl} onChange={e => setCl(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
