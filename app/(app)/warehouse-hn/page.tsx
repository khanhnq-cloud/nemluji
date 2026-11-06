"use client";
import { useMemo, useState } from "react";
import { PackagePlus, Pencil, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import { TransferBadge } from "@/components/Badge";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { adjustInventory, invQty, totalQty } from "@/lib/inventory";
import { cancelStockPurchase, canCancelStockPurchase, createStockPurchase, purchasableProducts } from "@/lib/purchase-actions";
import { EXPENSE_PAYMENT_METHOD_LABEL, formatDate, formatKg, formatMoney, formatNumber, monthISO, todayISO } from "@/lib/utils";
import type { ExpensePaymentMethod, StockPurchase } from "@/types";

type PurchaseForm = {
  purchaseDate: string; productId: string; qty: number; unitPrice: number;
  paymentMethod: ExpensePaymentMethod; supplier: string; note: string;
};

export default function WarehouseHnPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const canAdjust = can(user?.role, "adjust_inventory"); // chỉ admin
  const showFin = can(user?.role, "view_financials"); // giá vốn / giá trị tồn — chỉ admin
  const canPurchase = can(user?.role, "manage_stock_purchase");

  // Nhập hàng mua ngoài (vd Ram giòn)
  const buyable = purchasableProducts(state);
  const blankPurchase = (): PurchaseForm => ({
    purchaseDate: todayISO(), productId: buyable[0]?.id || "", qty: 0, unitPrice: 0,
    paymentMethod: "cash", supplier: "", note: "",
  });
  const [purchase, setPurchase] = useState<PurchaseForm | null>(null);
  const buyUnit = state.products.find(p => p.id === purchase?.productId)?.unit || "";
  const purchaseMonthCost = state.stockPurchases
    .filter(p => p.status === "active" && p.purchaseDate.startsWith(monthISO()))
    .reduce((sum, p) => sum + p.totalCost, 0);

  const savePurchase = () => {
    if (!purchase || !user) return;
    if (!purchase.productId) { alert("Chọn sản phẩm nhập"); return; }
    if (!(purchase.qty > 0)) { alert("Số lượng nhập phải lớn hơn 0"); return; }
    if (!(purchase.unitPrice > 0)) { alert("Giá nhập phải lớn hơn 0"); return; }
    if (!purchase.purchaseDate || purchase.purchaseDate > todayISO()) { alert("Ngày nhập không hợp lệ"); return; }
    update(s => createStockPurchase(s, purchase, user));
    setPurchase(null);
  };

  const cancelPurchase = (p: StockPurchase) => {
    if (!canCancelStockPurchase(state, p)) { alert("Tồn Kho Cát Linh không đủ để huỷ phiếu nhập (hàng đã xuất bán)."); return; }
    const reason = prompt("Lý do huỷ phiếu nhập:");
    if (!reason) return;
    update(s => cancelStockPurchase(s, p.id, reason));
  };

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
        actions={<>
          {canPurchase && <button className="btn-primary" onClick={() => setPurchase(blankPurchase())}><PackagePlus className="h-4 w-4" /> Nhập hàng</button>}
          {canAdjust && <button className="btn-secondary" onClick={openEdit}><Pencil className="h-4 w-4" /> Chỉnh tồn kho</button>}
        </>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Tồn kho Xưởng (kg)" value={formatKg(totalQty(state.factoryInventory))} />
        <StatCard label="Tồn kho Cát Linh (kg)" value={formatKg(totalQty(state.clInventory))} />
        {showFin && <StatCard label="Giá trị tồn Cát Linh" value={formatMoney(clValue)} />}
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
            {showFin && <><th className="text-right">Giá vốn/kg</th><th className="text-right">Giá trị tồn Cát Linh</th></>}
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
                  {showFin && <>
                    <td className="text-right">{formatMoney(p.fixCost)}</td>
                    <td className="text-right">{formatMoney(cl * p.fixCost)}</td>
                  </>}
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

      <div className="card overflow-x-auto">
        <div className="px-3 py-2 border-b font-semibold text-sm flex items-center justify-between gap-3">
          <span>Phiếu nhập hàng (mua ngoài)</span>
          {showFin && <span className="font-normal text-gray-500">Chi phí nhập tháng này: <b className="text-gray-900">{formatMoney(purchaseMonthCost)}</b></span>}
        </div>
        <table className="table-base">
          <thead><tr>
            <th>Mã</th><th>Ngày</th><th>Sản phẩm</th><th className="text-right">SL</th>
            {showFin && <><th className="text-right">Giá nhập</th><th className="text-right">Thành tiền</th></>}
            <th>Nhà cung cấp</th><th>Người nhập</th><th>Trạng thái</th>{canPurchase && <th></th>}
          </tr></thead>
          <tbody>
            {state.stockPurchases.map(p => {
              const prod = state.products.find(x => x.id === p.productId);
              return (
                <tr key={p.id} className={p.status === "cancelled" ? "opacity-50" : ""}>
                  <td className="font-medium">{p.code}</td>
                  <td>{formatDate(p.purchaseDate)}</td>
                  <td>{prod?.name || "—"}</td>
                  <td className="text-right">{formatNumber(p.qty, 1)} {prod?.unit}</td>
                  {showFin && <>
                    <td className="text-right">{formatMoney(p.unitPrice)}</td>
                    <td className="text-right font-medium">{formatMoney(p.totalCost)}</td>
                  </>}
                  <td>{p.supplier || "—"}</td>
                  <td>{state.profiles.find(x => x.id === p.createdBy)?.fullName || "—"}</td>
                  <td>{p.status === "active" ? <span className="badge-green">Đã nhập</span> : <span className="badge-gray" title={p.cancelReason}>Đã huỷ</span>}</td>
                  {canPurchase && (
                    <td className="text-right">
                      {p.status === "active" && (
                        <button className="btn-ghost btn-sm text-red-600" onClick={() => cancelPurchase(p)} title="Huỷ phiếu nhập"><X className="h-3.5 w-3.5" /></button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {state.stockPurchases.length === 0 && <EmptyState title="Chưa có phiếu nhập hàng" />}
      </div>

      <Modal
        open={canPurchase && !!purchase}
        onClose={() => setPurchase(null)}
        title="Nhập hàng vào Kho Cát Linh"
        size="sm"
        footer={<>
          <button className="btn-secondary" onClick={() => setPurchase(null)}>Huỷ</button>
          <button className="btn-primary" onClick={savePurchase}>Lưu phiếu nhập</button>
        </>}
      >
        {purchase && (
          <div className="space-y-3">
            <div className="text-xs text-gray-500">Dành cho hàng mua ngoài. Thành phẩm của xưởng vẫn về kho qua phiếu chuyển.</div>
            <div>
              <label className="label">Ngày nhập *</label>
              <input className="input" type="date" max={todayISO()} value={purchase.purchaseDate} onChange={e => setPurchase(f => f && { ...f, purchaseDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Sản phẩm *</label>
              <select className="input" value={purchase.productId} onChange={e => setPurchase(f => f && { ...f, productId: e.target.value })}>
                {buyable.length === 0 && <option value="">Chưa có sản phẩm mua ngoài</option>}
                {buyable.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Số lượng{buyUnit ? ` (${buyUnit})` : ""} *</label>
                <input className="input" type="number" min={0} step="0.01" value={purchase.qty || ""} onChange={e => setPurchase(f => f && { ...f, qty: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">Giá nhập / đơn vị (đ) *</label>
                <input className="input" type="number" min={0} value={purchase.unitPrice || ""} onChange={e => setPurchase(f => f && { ...f, unitPrice: Number(e.target.value) })} />
              </div>
            </div>
            <div className="text-sm">Thành tiền: <b>{formatMoney(Math.round(purchase.qty * purchase.unitPrice))}</b></div>
            <div>
              <label className="label">Hình thức thanh toán</label>
              <select className="input" value={purchase.paymentMethod} onChange={e => setPurchase(f => f && { ...f, paymentMethod: e.target.value as ExpensePaymentMethod })}>
                {Object.entries(EXPENSE_PAYMENT_METHOD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Nhà cung cấp</label>
              <input className="input" value={purchase.supplier} onChange={e => setPurchase(f => f && { ...f, supplier: e.target.value })} />
            </div>
            <div>
              <label className="label">Ghi chú</label>
              <input className="input" value={purchase.note} onChange={e => setPurchase(f => f && { ...f, note: e.target.value })} />
            </div>
          </div>
        )}
      </Modal>

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

