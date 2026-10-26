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

  // Chỉnh tồn: 1 hộp thoại sửa tất cả sản phẩm (Xưởng + Cát Linh). Chỉ admin.
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, { fac: string; cl: string }>>({});

  const openEdit = () => {
    const d: Record<string, { fac: string; cl: string }> = {};
    for (const p of state.products) {
      d[p.id] = { fac: String(invQty(state.factoryInventory, p.id)), cl: String(invQty(state.clInventory, p.id)) };
    }
    setDraft(d);
    setEditOpen(true);
  };

  const parse = (v: string) => (v.trim() === "" ? NaN : Number(v));
  const valid = state.products.every(p => {
    const d = draft[p.id];
    if (!d) return false;
    const f = parse(d.fac), c = parse(d.cl);
    return Number.isFinite(f) && Number.isFinite(c) && f >= 0 && c >= 0;
  });

  const saveEdit = () => {
    if (!canAdjust || !valid) return;
    update(s => {
      let factoryInventory = s.factoryInventory;
      let clInventory = s.clInventory;
      for (const p of s.products) {
        const d = draft[p.id];
        if (!d) continue;
        factoryInventory = adjustInventory(factoryInventory, p.id, parse(d.fac) - invQty(factoryInventory, p.id));
        clInventory = adjustInventory(clInventory, p.id, parse(d.cl) - invQty(clInventory, p.id));
      }
      return { ...s, factoryInventory, clInventory };
    });
    setEditOpen(false);
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
      <PageHeader title="Kho thành phẩm — Xưởng ↔ Cát Linh" subtitle="Tồn 2 kho liên kết: Sản xuất → Xưởng → (chuyển kho) → Cát Linh → (bán hàng) trừ Cát Linh"
        actions={canAdjust && <button className="btn-primary" onClick={openEdit}><Pencil className="h-4 w-4" /> Chỉnh tồn kho</button>}
      />

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
                      <button className="btn-ghost btn-sm" onClick={openEdit} title="Chỉnh tồn kho">
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
        open={canAdjust && editOpen}
        onClose={() => setEditOpen(false)}
        title="Chỉnh tồn kho thành phẩm"
        size="md"
        footer={<>
          <button className="btn-secondary" onClick={() => setEditOpen(false)}>Huỷ</button>
          <button className="btn-primary" disabled={!valid} onClick={saveEdit}>Lưu thay đổi</button>
        </>}
      >
        <div className="text-xs text-gray-500 mb-3">Nhập số tồn thực tế (kg) cho từng sản phẩm. Giá trị mới sẽ thay thế số tồn hiện tại.</div>
        <table className="table-base">
          <thead><tr><th>Sản phẩm</th><th className="text-right">Tồn Xưởng (kg)</th><th className="text-right">Tồn Cát Linh (kg)</th></tr></thead>
          <tbody>
            {state.products.map(p => (
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td><input className="input text-right" type="number" min={0} step="0.01" value={draft[p.id]?.fac ?? ""}
                  onChange={e => setDraft(d => ({ ...d, [p.id]: { ...(d[p.id] ?? { fac: "", cl: "" }), fac: e.target.value } }))} /></td>
                <td><input className="input text-right" type="number" min={0} step="0.01" value={draft[p.id]?.cl ?? ""}
                  onChange={e => setDraft(d => ({ ...d, [p.id]: { ...(d[p.id] ?? { fac: "", cl: "" }), cl: e.target.value } }))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>
    </div>
  );
}

