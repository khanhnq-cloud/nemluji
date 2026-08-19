"use client";
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { PaymentBadge } from "@/components/Badge";
import SortableHeader, { type SortDirection } from "@/components/SortableHeader";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { calcOrder, calcOrderItem } from "@/lib/cost";
import { createOrder, updateOrderPaymentStatus, updateOrderShipFee } from "@/lib/order-actions";
import { invQty, totalQty } from "@/lib/inventory";
import {
  formatDate, formatTime, formatDateTime, formatKg, formatMoney, formatNumber, newId, nextSequentialCode, todayISO,
  PAYMENT_STATUS_LABEL, CUSTOMER_GROUP_LABEL, COMPANY_ASSIGNEE,
} from "@/lib/utils";
import { Plus, Trash2, X, Gift, Eye, Download, Warehouse, UserPlus, Filter, HandCoins } from "lucide-react";
import MckModal from "@/components/MckModal";
import ExpenseModal from "@/components/ExpenseModal";
import { summarizeFinanceDay } from "@/lib/finance";
import type { Customer, CustomerBranch, CustomerGroup, Order, OrderItem, PaymentStatus } from "@/types";

const ORDER_PAYMENT_STATUSES: PaymentStatus[] = ["cash_done", "da_ck", "chua_ck", "cong_no"];

type OrderSortColumn = "date" | "code" | "customer" | "sale" | "soldQty" | "giftQty" | "revenue" | "ship" | "payment";

const soldQtyOf = (order: Order) => order.items.reduce((sum, item) => sum + (item.isGift ? 0 : item.quantity), 0);
const giftQtyOf = (order: Order) => order.items.reduce((sum, item) => sum + (item.isGift ? item.quantity : 0), 0);

type QuickCustomerForm = {
  fullName: string;
  customerGroup: CustomerGroup;
  phone: string;
  region: string;
  branchAddress: string;
  branchPhone: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyFax: string;
  legalRepresentative: string;
  legalRepresentativeTitle: string;
};

const blankQuickCustomer = (): QuickCustomerForm => ({
  fullName: "",
  customerGroup: "quan_an_nha_hang",
  phone: "",
  region: "",
  branchAddress: "",
  branchPhone: "",
  companyName: "",
  companyAddress: "",
  companyPhone: "",
  companyFax: "",
  legalRepresentative: "",
  legalRepresentativeTitle: "",
});

export default function OrdersPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mckOpen, setMckOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [fSale, setFSale] = useState("");
  const [fPay, setFPay] = useState("");
  const [fGroup, setFGroup] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortColumn, setSortColumn] = useState<OrderSortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const isSale = user?.role === "sale";
  const showFin = can(user?.role, "view_financials"); // Net Revenue / Cost / Profit — chỉ admin
  const sales = state.profiles.filter(p => p.role === "sale" || p.role === "manager");
  const detail = state.orders.find(o => o.id === detailId) || null;
  const clStockTotal = totalQty(state.clInventory);
  const clStockLines = useMemo(() => state.products
    .filter(product => product.isActive)
    .map(product => ({ ...product, qtyKg: invQty(state.clInventory, product.id) })),
  [state.products, state.clInventory]);

  // Ô tìm kiếm khách theo tên (autocomplete)
  const [custQuery, setCustQuery] = useState("");
  const [custOpen, setCustOpen] = useState(false);
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState<QuickCustomerForm>(blankQuickCustomer);

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

  const resetForm = () => {
    setForm(blank());
    setCustQuery("");
    setCustOpen(false);
    setQuickCustomerOpen(false);
    setQuickCustomer(blankQuickCustomer());
  };

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

  const createQuickCustomer = () => {
    const draft = quickCustomer;
    const isSupermarket = draft.customerGroup === "sieu_thi_minimart";
    if (!draft.fullName.trim() || !draft.phone.trim() || !draft.region.trim() || !draft.branchAddress.trim()) {
      alert("Nhập đủ tên khách, điện thoại, khu vực và địa chỉ chi nhánh.");
      return;
    }
    if (isSupermarket && (!draft.companyName.trim() || !draft.companyAddress.trim() || !draft.companyPhone.trim() || !draft.legalRepresentative.trim() || !draft.legalRepresentativeTitle.trim())) {
      alert("Nhập đầy đủ thông tin doanh nghiệp của khách Siêu thị / Minimart.");
      return;
    }

    const customerId = newId();
    const customerCode = nextSequentialCode("KH", state.customers.map(customer => customer.customerCode));
    const assignedSaleId = isSale ? user!.id : (form.saleId || COMPANY_ASSIGNEE);
    const customer: Customer = {
      id: customerId,
      customerCode,
      fullName: draft.fullName.trim(),
      customerGroup: draft.customerGroup,
      region: draft.region.trim(),
      assignedSaleId,
      phone: draft.phone.trim(),
      companyName: isSupermarket ? draft.companyName.trim() : undefined,
      companyAddress: isSupermarket ? draft.companyAddress.trim() : undefined,
      companyPhone: isSupermarket ? draft.companyPhone.trim() : undefined,
      companyFax: isSupermarket ? draft.companyFax.trim() || undefined : undefined,
      legalRepresentative: isSupermarket ? draft.legalRepresentative.trim() : undefined,
      legalRepresentativeTitle: isSupermarket ? draft.legalRepresentativeTitle.trim() : undefined,
      status: "active",
    };
    const branch: CustomerBranch = {
      id: newId(),
      branchCode: `${customerCode}-CN1`,
      customerId,
      branchName: `${customer.fullName} - CN1`,
      address: draft.branchAddress.trim(),
      phone: draft.branchPhone.trim() || customer.phone || "",
      status: "active",
    };

    update(current => ({
      ...current,
      customers: [customer, ...current.customers],
      branches: [...current.branches, branch],
    }));
    setForm(current => ({
      ...current,
      customerId,
      saleId: current.saleId || (assignedSaleId !== COMPANY_ASSIGNEE ? assignedSaleId : ""),
    }));
    setCustQuery(customer.fullName);
    setCustOpen(false);
    setQuickCustomerOpen(false);
    setQuickCustomer(blankQuickCustomer());
  };

  const canEditOrderToday = (order: Order) =>
    order.status === "active" &&
    can(user?.role, "manage_orders") &&
    order.createdAt.slice(0, 10) === todayISO();

  const saveShipFee = (orderId: string, value: string) => {
    const shipFee = Number(value);
    if (!Number.isFinite(shipFee)) return;
    update(current => updateOrderShipFee(current, orderId, shipFee));
  };

  const savePaymentStatus = (orderId: string, paymentStatus: PaymentStatus) => {
    if (!user) return;
    update(current => updateOrderPaymentStatus(current, orderId, paymentStatus, user));
  };

  const calc = useMemo(() => calcOrder({
    items: form.items,
    shipFee: form.shipFee,
    discountSpecial: 0,
    discountMonthlyPct: form.quantityDiscountPct,
    discountEarlyPayPct: 0,
    saleCommissionPct: state.profiles.find(p => p.id === form.saleId)?.commissionPct ?? state.settings.defaultCommissionPct,
  }), [form, state.profiles, state.settings]);

  const filtered = useMemo(() => {
    const rows = state.orders.filter(o => {
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
    });

    const valueOf = (order: Order): string | number => {
      switch (sortColumn) {
        case "date": return `${order.orderDate} ${order.createdAt}`;
        case "code": return order.orderCode;
        case "customer": return state.customers.find(customer => customer.id === order.customerId)?.fullName || "";
        case "sale": return state.profiles.find(profile => profile.id === order.saleId)?.fullName || "";
        case "soldQty": return soldQtyOf(order);
        case "giftQty": return giftQtyOf(order);
        case "revenue": return order.revenue;
        case "ship": return order.shipFee;
        case "payment": return PAYMENT_STATUS_LABEL[order.paymentStatus] || order.paymentStatus;
      }
    };

    return [...rows].sort((a, b) => {
      const left = valueOf(a);
      const right = valueOf(b);
      const comparison = typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right), "vi", { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [state.orders, state.customers, state.profiles, isSale, user, fSale, fPay, fGroup, from, to, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    const nextColumn = column as OrderSortColumn;
    if (nextColumn === sortColumn) {
      setSortDirection(current => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortColumn(nextColumn);
    setSortDirection(nextColumn === "date" ? "desc" : "asc");
  };

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
    const headers = ["Mã đơn", "Ngày", "Giờ tạo", "Khách", "Sale", "SL", "SL tặng", "Revenue", "Ship",
      ...(showFin ? ["Net Revenue", "Cost", "Hoa hồng", "Profit"] : []),
      "Thanh toán", "Trạng thái"];
    const esc = (v: any) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [headers.join(",")];
    filtered.forEach(o => {
      const c = state.customers.find(x => x.id === o.customerId);
      const sl = state.profiles.find(x => x.id === o.saleId);
      lines.push([
        o.orderCode, formatDate(o.orderDate), formatTime(o.createdAt), c?.fullName, sl?.fullName,
        soldQtyOf(o), giftQtyOf(o), o.revenue, o.shipFee,
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
            {can(user?.role, "manage_orders") && <button className="btn-secondary" onClick={() => setMckOpen(true)}><Filter className="h-4 w-4" /> Lọc hàng</button>}
            {can(user?.role, "manage_orders") && <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Tạo đơn</button>}
            {can(user?.role, "manage_expenses") && <button className="btn-primary" onClick={() => setExpenseOpen(true)}><HandCoins className="h-4 w-4" /> Tạo phiếu chi</button>}
          </>
        }
      />

      <div className="card p-4 border-blue-200 bg-blue-50/30">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
          <div className="lg:w-56 shrink-0">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Tồn kho Cát Linh</span>
              <Warehouse className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{formatKg(clStockTotal)}</div>
            <div className="mt-1 text-xs text-gray-500">Tổng thành phẩm có thể tạo đơn</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-3 flex-1">
            {clStockLines.map(product => (
              <div key={product.id} className="border-l border-blue-200 pl-3 min-w-0">
                <div className="text-xs text-gray-500 truncate" title={product.name}>{product.name}</div>
                <div className={`text-sm font-semibold ${product.qtyKg <= 0 ? "text-red-600" : "text-gray-900"}`}>{formatKg(product.qtyKg)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

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
          {ORDER_PAYMENT_STATUSES.map(status => <option key={status} value={status}>{PAYMENT_STATUS_LABEL[status]}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr>
            <SortableHeader label="Ngày / giờ" column="date" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
            <SortableHeader label="Mã đơn" column="code" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
            <SortableHeader label="Khách" column="customer" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
            <SortableHeader label="Sale" column="sale" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
            <SortableHeader label="SL" column="soldQty" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
            <SortableHeader label="SL tặng" column="giftQty" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
            <SortableHeader label="Revenue" column="revenue" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
            <SortableHeader label="Ship" column="ship" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
            <SortableHeader label="Thanh toán" column="payment" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
            <th></th>
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
                  <td className="text-right">{formatNumber(soldQtyOf(o), 1)}</td>
                  <td className="text-right">{formatNumber(giftQtyOf(o), 1)}</td>
                  <td className="text-right">{formatMoney(o.revenue)}</td>
                  <td className="text-right" onClick={event => event.stopPropagation()}>
                    {canEditOrderToday(o) ? (
                      <input
                        type="number"
                        className="input w-28 py-1.5 text-right ml-auto"
                        defaultValue={o.shipFee}
                        aria-label={`Phí ship ${o.orderCode}`}
                        title="Được sửa đến hết ngày tạo đơn"
                        onBlur={event => saveShipFee(o.id, event.currentTarget.value)}
                        onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}
                      />
                    ) : formatMoney(o.shipFee)}
                  </td>
                  <td onClick={event => event.stopPropagation()}>
                    {canEditOrderToday(o) ? (
                      <select
                        className="input min-w-32 py-1.5"
                        value={o.paymentStatus}
                        aria-label={`Thanh toán ${o.orderCode}`}
                        title="Được sửa đến hết ngày tạo đơn"
                        onChange={event => savePaymentStatus(o.id, event.target.value as PaymentStatus)}
                      >
                        {ORDER_PAYMENT_STATUSES.map(status => <option key={status} value={status}>{PAYMENT_STATUS_LABEL[status]}</option>)}
                      </select>
                    ) : <PaymentBadge status={o.paymentStatus} />}
                  </td>
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

      {/* F8 — Chốt tiền cuối ngày (hôm nay) */}
      {can(user?.role, "view_expenses") && <DaySettlement />}

      {/* Modal chi tiết đơn */}
      <OrderDetailModal order={detail} onClose={() => setDetailId(null)} />

      <MckModal open={mckOpen} onClose={() => setMckOpen(false)} />
      <ExpenseModal open={expenseOpen} onClose={() => setExpenseOpen(false)} />

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
                <div className="flex gap-2">
                  <input
                    className="input min-w-0"
                    placeholder="Nhập tên khách hàng…"
                    value={custQuery}
                    onChange={e => { setCustQuery(e.target.value); setCustOpen(true); setForm(f => ({ ...f, customerId: "" })); }}
                    onFocus={() => setCustOpen(true)}
                    onBlur={() => setTimeout(() => setCustOpen(false), 150)}
                  />
                  {can(user?.role, "manage_customers") && (
                    <button
                      type="button"
                      className="btn-secondary shrink-0 whitespace-nowrap"
                      onClick={() => {
                        setQuickCustomer(current => ({ ...current, fullName: current.fullName || custQuery }));
                        setQuickCustomerOpen(current => !current);
                        setCustOpen(false);
                      }}
                    >
                      <UserPlus className="h-4 w-4" /> Khách mới
                    </button>
                  )}
                </div>
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

            {quickCustomerOpen && (
              <div className="mt-3 border border-brand-200 bg-brand-50/30 rounded-md p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-gray-700">Tạo nhanh khách hàng và chi nhánh đầu tiên</div>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setQuickCustomerOpen(false)} aria-label="Đóng tạo khách nhanh"><X className="h-4 w-4" /></button>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <label>
                    <span className="label">Tên khách *</span>
                    <input className="input" value={quickCustomer.fullName} onChange={event => setQuickCustomer(current => ({ ...current, fullName: event.target.value }))} />
                  </label>
                  <label>
                    <span className="label">Nhóm khách *</span>
                    <select className="input" value={quickCustomer.customerGroup} onChange={event => setQuickCustomer(current => ({ ...current, customerGroup: event.target.value as CustomerGroup }))}>
                      {Object.entries(CUSTOMER_GROUP_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="label">SĐT liên hệ *</span>
                    <input type="tel" className="input" value={quickCustomer.phone} onChange={event => setQuickCustomer(current => ({ ...current, phone: event.target.value }))} />
                  </label>
                  <label>
                    <span className="label">Khu vực *</span>
                    <input className="input" value={quickCustomer.region} onChange={event => setQuickCustomer(current => ({ ...current, region: event.target.value }))} placeholder="Quận / tỉnh" />
                  </label>
                  <label>
                    <span className="label">Địa chỉ chi nhánh *</span>
                    <input className="input" value={quickCustomer.branchAddress} onChange={event => setQuickCustomer(current => ({ ...current, branchAddress: event.target.value }))} />
                  </label>
                  <label>
                    <span className="label">SĐT chi nhánh</span>
                    <input type="tel" className="input" value={quickCustomer.branchPhone} onChange={event => setQuickCustomer(current => ({ ...current, branchPhone: event.target.value }))} placeholder="Mặc định dùng SĐT chính" />
                  </label>
                </div>

                {quickCustomer.customerGroup === "sieu_thi_minimart" && (
                  <div className="border-t border-brand-200 pt-3">
                    <div className="text-xs font-semibold uppercase text-gray-500 mb-2">Thông tin doanh nghiệp</div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label><span className="label">Tên công ty *</span><input className="input" value={quickCustomer.companyName} onChange={event => setQuickCustomer(current => ({ ...current, companyName: event.target.value }))} /></label>
                      <label><span className="label">Địa chỉ công ty *</span><input className="input" value={quickCustomer.companyAddress} onChange={event => setQuickCustomer(current => ({ ...current, companyAddress: event.target.value }))} /></label>
                      <label><span className="label">Điện thoại công ty *</span><input type="tel" className="input" value={quickCustomer.companyPhone} onChange={event => setQuickCustomer(current => ({ ...current, companyPhone: event.target.value }))} /></label>
                      <label><span className="label">Fax</span><input className="input" value={quickCustomer.companyFax} onChange={event => setQuickCustomer(current => ({ ...current, companyFax: event.target.value }))} /></label>
                      <label><span className="label">Người đại diện *</span><input className="input" value={quickCustomer.legalRepresentative} onChange={event => setQuickCustomer(current => ({ ...current, legalRepresentative: event.target.value }))} /></label>
                      <label><span className="label">Chức vụ *</span><input className="input" value={quickCustomer.legalRepresentativeTitle} onChange={event => setQuickCustomer(current => ({ ...current, legalRepresentativeTitle: event.target.value }))} /></label>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button type="button" className="btn-primary" onClick={createQuickCustomer}><UserPlus className="h-4 w-4" /> Tạo và chọn khách này</button>
                </div>
              </div>
            )}
          </div>

          {/* Section: Dòng hàng */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-gray-700">2. Dòng hàng</div>
              <button className="btn-secondary btn-sm" onClick={addItem}><Plus className="h-3.5 w-3.5" /> Thêm dòng</button>
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-md">
              <table className="table-base">
                <thead><tr><th>Sản phẩm</th><th className="text-right">Tồn Cát Linh</th><th className="w-28">SL</th><th className="w-36">Đơn giá</th><th className="w-16 text-center">Tặng</th><th className="text-right w-28">Doanh thu</th><th className="text-right w-28">Cost</th><th></th></tr></thead>
                <tbody>
                  {form.items.map(it => (
                    <tr key={it.id} className={it.isGift ? "bg-purple-50/40" : ""}>
                      <td>
                        <select className="input" value={it.productId} onChange={e => setItem(it.id, { productId: e.target.value })}>
                          {state.products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                        </select>
                      </td>
                      <td className={`text-right whitespace-nowrap font-medium ${it.quantity > invQty(state.clInventory, it.productId) ? "text-red-600" : "text-blue-700"}`}>
                        {formatKg(invQty(state.clInventory, it.productId))}
                      </td>
                      <td><input type="number" min="0" step="0.1" className="input min-w-24" value={it.quantity || ""} onChange={e => setItem(it.id, { quantity: Number(e.target.value) })} /></td>
                      <td><input type="number" min="0" className="input min-w-32" value={it.unitPrice || ""} disabled={it.isGift} onChange={e => setItem(it.id, { unitPrice: Number(e.target.value) })} /></td>
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
                  {ORDER_PAYMENT_STATUSES.map(status => <option key={status} value={status}>{PAYMENT_STATUS_LABEL[status]}</option>)}
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
            Lưu đơn sẽ tự sinh phiếu thu: Cash done → đã duyệt; đã CK → chờ Admin duyệt; chưa CK/công nợ → chờ. Đồng thời trừ tồn kho CL và cập nhật dự báo ngày lấy tiếp.
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

function DaySettlement() {
  const { state } = useStore();
  const [date, setDate] = useState(todayISO());
  const fin = useMemo(
    () => summarizeFinanceDay(state.orders, state.receipts, state.expenses, date),
    [state.orders, state.receipts, state.expenses, date],
  );
  return (
    <div className="card p-4 border-emerald-200 bg-emerald-50/30">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="text-sm font-semibold text-gray-800">Chốt tiền cuối ngày</div>
        <input type="date" className="input w-44" value={date} max={todayISO()} onChange={e => setDate(e.target.value)} aria-label="Ngày chốt tiền" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
        <div><div className="text-xs text-gray-500">Tiền hàng nhận về</div><div className="font-semibold text-emerald-700">{formatMoney(fin.actualRevenue)}</div><div className="text-xs text-gray-400">Phiếu thu đã duyệt</div></div>
        <div><div className="text-xs text-gray-500">Σ phiếu chi</div><div className="font-semibold text-red-600">{formatMoney(fin.expenses)}</div><div className="text-xs text-gray-400">{fin.expenseCount} phiếu</div></div>
        <div><div className="text-xs text-gray-500">Σ phí ship</div><div className="font-semibold text-red-600">{formatMoney(fin.shippingCost)}</div><div className="text-xs text-gray-400">{fin.shippingOrderCount} đơn có ship</div></div>
        <div><div className="text-xs text-gray-500">Tổng chi phí</div><div className="font-semibold text-red-600">{formatMoney(fin.totalCost)}</div><div className="text-xs text-gray-400">phiếu chi + ship</div></div>
      </div>
      <div className="border-t border-emerald-200 mt-3 pt-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">Tổng tiền = tiền hàng nhận về − tổng chi phí</span>
        <span className={`text-lg font-bold ${fin.netCash < 0 ? "text-red-600" : "text-emerald-700"}`}>{formatMoney(fin.netCash)}</span>
      </div>
    </div>
  );
}
