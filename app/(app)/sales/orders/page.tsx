"use client";
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { PaymentBadge, StatusBadge } from "@/components/Badge";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { calcOrder, calcOrderItem } from "@/lib/cost";
import { createOrder } from "@/lib/order-actions";
import {
  formatDate, formatTime, formatDateTime, formatMoney, formatNumber, newId, todayISO,
  PAYMENT_STATUS_LABEL, CUSTOMER_GROUP_LABEL,
} from "@/lib/utils";
import { Plus, Trash2, X, Gift, Eye, Download } from "lucide-react";
import type { Order, OrderItem, PaymentStatus } from "@/types";

export default function OrdersPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [fSale, setFSale] = useState("");
  const [fPay, setFPay] = useState("");
  const [fGroup, setFGroup] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const isSale = user?.role === "sale";
  const showFin = can(user?.role, "view_financials"); // Net Revenue / Cost / Profit — chỉ admin
  const sales = state.profiles.filter(p => p.role === "sale" || p.role === "manager");
  const totalQtyOf = (o: Order) => o.items.reduce((s, i) => s + i.quantity, 0);
  const detail = state.orders.find(o => o.id === detailId) || null;

  // Ô tìm kiếm khách theo tên (autocomplete)
  const [custQuery, setCustQuery] = useState("");
  const [custOpen, setCustOpen] = useState(false);

  const newItem = (): OrderItem => {
    const p = state.products[0];
    return calcOrderItem({ id: newId(), productId: p?.id, quantity: 1, unitPrice: p?.defaultPrice, isGift: false, fixCostUnit: p?.fixCost }, p);
  };
  type Form = {
    orderDate: string; customerId: string; saleId: string;
    items: OrderItem[]; shipFee: number; quantityDiscountPct: number;
    paymentStatus: PaymentStatus; note?: string;
  };
  const blank = (): Form => ({
    orderDate: todayISO(),
    customerId: "",
    saleId: isSale ? user!.id : "",
    items: [newItem()],
    shipFee: 0,
    quantityDiscountPct: 10,
    paymentStatus: "chua_ck",
  });
  const [form, setForm] = useState<Form>(blank());

  const resetForm = () => { setForm(blank()); setCustQuery(""); setCustOpen(false); };

  // Khách phù hợp với từ khoá tìm kiếm
  const custMatches = useMemo(() => {
    const q = custQuery.trim().toLowerCase();
    return state.customers
      .filter(c => c.status === "active" && (!q || `${c.fullName} ${c.customerCode} ${c.phone || ""}`.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [state.customers, custQuery]);

  // Chọn khách → tự kéo sale phụ trách từ dữ liệu /customers
  const selectCustomer = (c: typeof state.customers[number]) => {
    const assignedSale = state.profiles.find(p => p.id === c.assignedSaleId && p.role === "sale");
    setForm(f => ({ ...f, customerId: c.id, saleId: isSale ? user!.id : (assignedSale ? assignedSale.id : f.saleId) }));
    setCustQuery(c.fullName);
    setCustOpen(false);
  };

  const calc = useMemo(() => calcOrder({
    items: form.items,
    shipFee: form.shipFee,
    discountSpecial: 0,
    discountMonthlyPct: form.quantityDiscountPct,
    discountEarlyPayPct: 0,
    saleCommissionPct: state.profiles.find(p => p.id === form.saleId)?.commissionPct ?? state.settings.defaultCommissionPct,
  }), [form, state.profiles, state.settings]);

  const filtered = useMemo(() => state.orders.filter(o => {
    if (isSale && o.saleId !== user?.id) return false;
    if (fSale && o.saleId !== fSale) return false;
    if (fPay && o.paymentStatus !== fPay) return false;
    if (from && o.orderDate < from) return false;
    if (to && o.orderDate > to) return false;
    if (fGroup) {
      const c = state.customers.find(x => x.id === o.customerId);
      if (c?.customerGroup !== fGroup) return false;
    }
    return true;
  }).sort((a, b) => b.orderDate.localeCompare(a.orderDate)), [state.orders, state.customers, isSale, user, fSale, fPay, fGroup, from, to]);

  const setItem = (id: string, patch: Partial<OrderItem>) => setForm(f => ({
    ...f,
    items: f.items.map(it => {
      if (it.id !== id) return it;
      const merged = { ...it, ...patch };
      if (patch.productId !== undefined) {
        const p = state.products.find(x => x.id === patch.productId);
        if (p) { merged.unitPrice = patch.unitPrice ?? p.defaultPrice; merged.fixCostUnit = p.fixCost; }
      }
      return calcOrderItem(merged, state.products.find(x => x.id === merged.productId));
    }),
  }));
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, newItem()] }));
  const removeItem = (id: string) => setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }));

  const submit = () => {
    if (!form.customerId) { alert("Chọn khách hàng"); return; }
    if (!form.saleId) { alert("Chọn sale phụ trách"); return; }
    if (form.items.length === 0) { alert("Đơn phải có ít nhất 1 dòng hàng"); return; }
    if (form.items.some(i => i.quantity <= 0)) { alert("Số lượng phải > 0"); return; }
    if (form.quantityDiscountPct < 0 || form.quantityDiscountPct > 100) { alert("Chiết khấu số lượng phải từ 0% đến 100%"); return; }
    if (form.orderDate > todayISO()) { alert("Ngày đơn không được ở tương lai"); return; }
    // Chi nhánh tự gán = chi nhánh đầu của khách (dữ liệu đi từ /customers)
    const branch = state.branches.find(b => b.customerId === form.customerId);
    if (!branch) { alert("Khách chưa có chi nhánh. Vào /customers thêm chi nhánh trước."); return; }
    if (calc.cost > calc.revenueNet) {
      if (!confirm("⚠️ Cost > Net Revenue (đơn lỗ). Vẫn lưu?")) return;
    }
    const pct = state.profiles.find(p => p.id === form.saleId)?.commissionPct ?? state.settings.defaultCommissionPct;
    update(s => createOrder(s, {
      ...form,
      branchId: branch.id,
      discountSpecial: 0,
      discountMonthlyPct: form.quantityDiscountPct,
      discountEarlyPayPct: 0,
      saleCommissionPct: pct,
    }, user!));
    setOpen(false);
    resetForm();
  };

  const cancelOrder = (id: string) => {
    const reason = prompt("Lý do huỷ đơn:");
    if (!reason) return;
    update(s => ({
      ...s,
      orders: s.orders.map(o => o.id === id ? { ...o, status: "cancelled", cancelReason: reason } : o),
      receipts: s.receipts.map(r => r.orderId === id && r.status !== "approved" ? { ...r, status: "cancelled" } : r),
    }));
  };

  // Xuất Excel (CSV UTF-8 BOM, mở được bằng Excel) — đủ cột gồm net/cost/profit
  const exportExcel = () => {
    // Net Revenue / Cost / Profit chỉ xuất khi là admin
    const headers = ["Mã đơn", "Ngày", "Giờ tạo", "Khách", "Sale", "SL", "Revenue", "Ship",
      ...(showFin ? ["Net Revenue", "Cost", "Hoa hồng", "Profit"] : []),
      "Thanh toán", "Trạng thái"];
    const esc = (v: any) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [headers.join(",")];
    filtered.forEach(o => {
      const c = state.customers.find(x => x.id === o.customerId);
      const sl = state.profiles.find(x => x.id === o.saleId);
      lines.push([
        o.orderCode, formatDate(o.orderDate), formatTime(o.createdAt), c?.fullName, sl?.fullName,
        totalQtyOf(o), o.revenue, o.shipFee,
        ...(showFin ? [o.revenueNet, o.cost, o.saleCommission, o.profitNet] : []),
        PAYMENT_STATUS_LABEL[o.paymentStatus] || o.paymentStatus, o.status === "active" ? "Hoạt động" : "Đã huỷ",
      ].map(esc).join(","));
    });
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `don-hang-${todayISO()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Đơn hàng"
        subtitle={`${filtered.length} đơn`}
        actions={
          <>
            <button className="btn-secondary" onClick={exportExcel} disabled={filtered.length === 0}><Download className="h-4 w-4" /> Xuất Excel</button>
            {can(user?.role, "manage_orders") && <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Tạo đơn</button>}
          </>
        }
      />

      <div className="card p-3 flex flex-wrap gap-2 items-center">
        <input type="date" className="input w-40" value={from} onChange={e => setFrom(e.target.value)} />
        <span className="text-xs text-gray-500">→</span>
        <input type="date" className="input w-40" value={to} onChange={e => setTo(e.target.value)} />
        {!isSale && (
          <select className="input w-44" value={fSale} onChange={e => setFSale(e.target.value)}>
            <option value="">Tất cả sale</option>
            {sales.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </select>
        )}
        <select className="input w-40" value={fGroup} onChange={e => setFGroup(e.target.value)}>
          <option value="">Tất cả nhóm KH</option>
          {Object.entries(CUSTOMER_GROUP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input w-40" value={fPay} onChange={e => setFPay(e.target.value)}>
          <option value="">Tất cả TT</option>
          {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr>
            <th>Ngày / giờ</th><th>Mã đơn</th><th>Khách</th><th>Sale</th>
            <th className="text-right">SL</th><th className="text-right">Revenue</th><th className="text-right">Ship</th>
            <th>TT</th><th>Trạng thái</th><th></th>
          </tr></thead>
          <tbody>
            {filtered.map(o => {
              const c = state.customers.find(x => x.id === o.customerId);
              const s = state.profiles.find(x => x.id === o.saleId);
              return (
                <tr key={o.id} className={`cursor-pointer ${o.status === "cancelled" ? "opacity-50" : ""}`} onClick={() => setDetailId(o.id)}>
                  <td>
                    <div>{formatDate(o.orderDate)}</div>
                    <div className="text-xs text-gray-500">{formatTime(o.createdAt)}</div>
                  </td>
                  <td className="font-medium text-brand-700">{o.orderCode}</td>
                  <td>{c?.fullName}</td>
                  <td>{s?.fullName}</td>
                  <td className="text-right">{formatNumber(totalQtyOf(o), 1)}</td>
                  <td className="text-right">{formatMoney(o.revenue)}</td>
                  <td className="text-right">{formatMoney(o.shipFee)}</td>
                  <td><PaymentBadge status={o.paymentStatus} /></td>
                  <td><StatusBadge status={o.status} /></td>
                  <td onClick={e => e.stopPropagation()} className="whitespace-nowrap space-x-1">
                    <button className="btn-ghost btn-sm" onClick={() => setDetailId(o.id)} title="Xem chi tiết"><Eye className="h-3.5 w-3.5" /></button>
                    {o.status === "active" && can(user?.role, "manage_orders") && (
                      <button className="btn-ghost btn-sm text-red-600" onClick={() => cancelOrder(o.id)} title="Huỷ đơn"><X className="h-3.5 w-3.5" /></button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState />}
      </div>

      {/* Modal chi tiết đơn */}
      <OrderDetailModal order={detail} onClose={() => setDetailId(null)} />

      <Modal open={open} onClose={() => { setOpen(false); resetForm(); }} title="Tạo đơn hàng" size="xl" footer={
        <>
          <button className="btn-secondary" onClick={() => { setOpen(false); resetForm(); }}>Huỷ</button>
          <button className="btn-primary" onClick={submit}>Lưu đơn</button>
        </>
      }>
        <div className="space-y-4">
          {/* Section: Khách hàng */}
          <div>
            <div className="text-sm font-semibold mb-2 text-gray-700">1. Khách hàng & Sale</div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="relative">
                <label className="label">Khách hàng * <span className="text-gray-400 font-normal">(gõ tên để tìm)</span></label>
                <input
                  className="input"
                  placeholder="Nhập tên khách hàng…"
                  value={custQuery}
                  onChange={e => { setCustQuery(e.target.value); setCustOpen(true); setForm(f => ({ ...f, customerId: "" })); }}
                  onFocus={() => setCustOpen(true)}
                  onBlur={() => setTimeout(() => setCustOpen(false), 150)}
                />
                {custOpen && custMatches.length > 0 && !form.customerId && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                    {custMatches.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-brand-50 text-sm border-b border-gray-100 last:border-0"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => selectCustomer(c)}
                      >
                        <div className="font-medium">{c.fullName}</div>
                        <div className="text-xs text-gray-500">{c.customerCode} • {CUSTOMER_GROUP_LABEL[c.customerGroup]} • {c.region}{c.phone ? ` • ${c.phone}` : ""}</div>
                      </button>
                    ))}
                  </div>
                )}
                {custOpen && custQuery.trim() && custMatches.length === 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-sm text-gray-500">
                    Không tìm thấy khách. Thêm tại <b>/customers</b>.
                  </div>
                )}
              </div>
              <div>
                <label className="label">Sale phụ trách *</label>
                <select className="input" value={form.saleId} onChange={e => setForm(f => ({ ...f, saleId: e.target.value }))} disabled={isSale}>
                  <option value="">— chọn —</option>
                  {sales.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Ngày đơn *</label>
                <input type="date" className="input" value={form.orderDate} max={todayISO()} onChange={e => setForm(f => ({ ...f, orderDate: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Section: Dòng hàng */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-gray-700">2. Dòng hàng</div>
              <button className="btn-secondary btn-sm" onClick={addItem}><Plus className="h-3.5 w-3.5" /> Thêm dòng</button>
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-md">
              <table className="table-base">
                <thead><tr><th>Sản phẩm</th><th className="w-20">SL</th><th className="w-28">Đơn giá</th><th className="w-16 text-center">Tặng</th><th className="text-right w-28">Doanh thu</th><th className="text-right w-28">Cost</th><th></th></tr></thead>
                <tbody>
                  {form.items.map(it => (
                    <tr key={it.id} className={it.isGift ? "bg-purple-50/40" : ""}>
                      <td>
                        <select className="input" value={it.productId} onChange={e => setItem(it.id, { productId: e.target.value })}>
                          {state.products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                        </select>
                      </td>
                      <td><input type="number" step="0.1" className="input" value={it.quantity} onChange={e => setItem(it.id, { quantity: Number(e.target.value) })} /></td>
                      <td><input type="number" className="input" value={it.unitPrice} disabled={it.isGift} onChange={e => setItem(it.id, { unitPrice: Number(e.target.value) })} /></td>
                      <td className="text-center">
                        <button onClick={() => setItem(it.id, { isGift: !it.isGift })} className={it.isGift ? "text-purple-600" : "text-gray-300"} title="Hàng tặng">
                          <Gift className="h-4 w-4 mx-auto" />
                        </button>
                      </td>
                      <td className="text-right">{formatMoney(it.lineRevenue)}</td>
                      <td className="text-right text-gray-500">{formatMoney(it.lineCost)}</td>
                      <td><button className="btn-ghost btn-sm text-red-600" onClick={() => removeItem(it.id)}><Trash2 className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-gray-500 mt-1">Hàng tặng: doanh thu = 0, vẫn cộng cost theo giá vốn (fix_cost).</div>
          </div>

          {/* Section: Chiết khấu + phí ship + thanh toán */}
          <div>
            <div className="text-sm font-semibold mb-2 text-gray-700">3. Chiết khấu, phí ship & thanh toán</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="label">Chiết khấu số lượng (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  className="input"
                  value={form.quantityDiscountPct}
                  onChange={e => setForm(f => ({ ...f, quantityDiscountPct: Number(e.target.value) }))}
                  aria-label="Chiết khấu số lượng"
                />
              </div>
              <div><label className="label">Phí ship (đ, âm = cty trả)</label><input type="number" className="input" value={form.shipFee} onChange={e => setForm(f => ({ ...f, shipFee: Number(e.target.value) }))} /></div>
              <div>
                <label className="label">Trạng thái thanh toán *</label>
                <select className="input" value={form.paymentStatus} onChange={e => setForm(f => ({ ...f, paymentStatus: e.target.value as PaymentStatus }))}>
                  {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div><label className="label">Ghi chú</label><input className="input" value={form.note || ""} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></div>
            </div>
          </div>

          {/* Breakdown realtime — Net/Cost/Profit chỉ admin xem */}
          <div className="bg-gray-50 rounded-md p-3 text-sm space-y-1">
            <Row label="Subtotal (doanh thu hàng bán)" value={formatMoney(calc.breakdown.subtotal)} />
            <Row label={`− Chiết khấu số lượng (${formatNumber(form.quantityDiscountPct, 2)}%)`} value={formatMoney(calc.breakdown.subtotal - calc.breakdown.afterMonthly)} />
            <Row label="Sau chiết khấu số lượng" value={formatMoney(calc.breakdown.afterMonthly)} />
            <Row label="− Phí ship" value={formatMoney(form.shipFee)} />
            {showFin && (
              <>
                <div className="border-t border-gray-200 my-1" />
                <Row label="Net Revenue" value={formatMoney(calc.revenueNet)} bold className="text-blue-700" />
                <Row label="Cost (gồm hàng tặng)" value={formatMoney(calc.cost)} />
                <Row label={`Hoa hồng sale (${state.profiles.find(p => p.id === form.saleId)?.commissionPct ?? state.settings.defaultCommissionPct}%)`} value={formatMoney(calc.saleCommission)} />
                <Row label="Net Profit" value={formatMoney(calc.profitNet)} bold className={calc.profitNet < 0 ? "text-red-600" : "text-emerald-700"} />
              </>
            )}
          </div>
          <div className="text-xs text-gray-500">
            Lưu đơn sẽ tự sinh phiếu thu: tiền mặt → đã duyệt; đã CK → chờ Admin duyệt; chưa CK/công nợ → chờ. Đồng thời trừ tồn kho CL và cập nhật dự báo ngày lấy tiếp.
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value, bold, className }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className="flex justify-between">
      <span className={bold ? "font-semibold" : "text-gray-600"}>{label}</span>
      <span className={`${bold ? "font-semibold" : ""} ${className || ""}`}>{value}</span>
    </div>
  );
}

function OrderDetailModal({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { state } = useStore();
  const { user } = useAuth();
  const showFin = can(user?.role, "view_financials");
  if (!order) return null;
  const c = state.customers.find(x => x.id === order.customerId);
  const b = state.branches.find(x => x.id === order.branchId);
  const sale = state.profiles.find(x => x.id === order.saleId);
  const receipt = state.receipts.find(r => r.orderId === order.id);
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <Modal open={!!order} onClose={onClose} title={`Chi tiết đơn ${order.orderCode}`} size="lg" footer={<button className="btn-secondary" onClick={onClose}>Đóng</button>}>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <Info label="Mã đơn" value={order.orderCode} />
          <Info label="Ngày đặt" value={formatDate(order.orderDate)} />
          <Info label="Thời điểm tạo" value={formatDateTime(order.createdAt)} />
          <Info label="Khách hàng" value={c?.fullName || "—"} />
          <Info label="Chi nhánh" value={b?.branchName || "—"} />
          <Info label="Sale phụ trách" value={sale?.fullName || "—"} />
          <Info label="Thanh toán" value={PAYMENT_STATUS_LABEL[order.paymentStatus] || order.paymentStatus} />
          <Info label="Phiếu thu" value={receipt ? receipt.receiptCode : "—"} />
          <Info label="Trạng thái" value={order.status === "active" ? "Hoạt động" : `Đã huỷ${order.cancelReason ? " — " + order.cancelReason : ""}`} />
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">Dòng hàng ({totalQty} đv)</div>
          <div className="overflow-x-auto border border-gray-200 rounded-md">
            <table className="table-base">
              <thead><tr><th>Sản phẩm</th><th className="text-right">SL</th><th className="text-right">Đơn giá</th><th className="text-center">Tặng</th><th className="text-right">Doanh thu</th>{showFin && <th className="text-right">Cost</th>}</tr></thead>
              <tbody>
                {order.items.map(it => {
                  const p = state.products.find(x => x.id === it.productId);
                  return (
                    <tr key={it.id} className={it.isGift ? "bg-purple-50/40" : ""}>
                      <td>{p?.name || "—"} <span className="text-xs text-gray-400">({p?.unit})</span></td>
                      <td className="text-right">{formatNumber(it.quantity, 1)}</td>
                      <td className="text-right">{formatMoney(it.unitPrice)}</td>
                      <td className="text-center">{it.isGift ? <span className="badge-purple">Tặng</span> : ""}</td>
                      <td className="text-right">{formatMoney(it.lineRevenue)}</td>
                      {showFin && <td className="text-right text-gray-500">{formatMoney(it.lineCost)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gray-50 rounded-md p-3 text-sm space-y-1">
          <Row label="Revenue (doanh thu hàng bán)" value={formatMoney(order.revenue)} />
          <Row label={`− Chiết khấu số lượng (${formatNumber(order.discountMonthlyPct || 0, 2)}%)`} value={formatMoney(Math.round(Math.max(0, order.revenue - Number(order.discountSpecial || 0)) * (order.discountMonthlyPct || 0) / 100))} />
          <Row label="− Phí ship" value={formatMoney(order.shipFee)} />
          {showFin ? (
            <>
              <div className="border-t border-gray-200 my-1" />
              <Row label="Net Revenue" value={formatMoney(order.revenueNet)} bold className="text-blue-700" />
              <Row label="Cost (gồm hàng tặng)" value={formatMoney(order.cost)} />
              <Row label={`Hoa hồng sale (${order.saleCommissionPct}%)`} value={formatMoney(order.saleCommission)} />
              <Row label="Net Profit" value={formatMoney(order.profitNet)} bold className={order.profitNet < 0 ? "text-red-600" : "text-emerald-700"} />
            </>
          ) : (
            <div className="text-xs text-gray-400 pt-1">Net Revenue / Cost / Profit chỉ Admin xem được.</div>
          )}
        </div>
        {order.note && <div className="text-sm"><span className="text-gray-500">Ghi chú:</span> {order.note}</div>}
      </div>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="border border-gray-200 rounded-md p-2.5"><div className="text-xs text-gray-500">{label}</div><div className="font-medium mt-0.5">{value}</div></div>;
}
