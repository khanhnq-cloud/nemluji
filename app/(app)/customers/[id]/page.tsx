"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { PaymentBadge, StatusBadge } from "@/components/Badge";
import SortableHeader, { type SortDirection } from "@/components/SortableHeader";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { isBranchDue } from "@/lib/forecast";
import {
  CUSTOMER_GROUP_LABEL,
  PAYMENT_STATUS_LABEL,
  assigneeName,
  formatDate,
  formatMoney,
  formatNumber,
  formatTime,
} from "@/lib/utils";
import { ArrowLeft, Building2, CalendarDays, MapPin, PackageCheck, ReceiptText } from "lucide-react";
import type { Order, PaymentStatus } from "@/types";

type OrderSortColumn = "date" | "code" | "branch" | "products" | "soldQty" | "giftQty" | "revenue" | "ship" | "net" | "payment";

const PAYMENT_FILTERS: PaymentStatus[] = ["cash_done", "da_ck", "chua_ck", "cong_no"];

const soldQtyOf = (order: Order) => order.items.reduce((sum, item) => sum + (item.isGift ? 0 : item.quantity), 0);
const giftQtyOf = (order: Order) => order.items.reduce((sum, item) => sum + (item.isGift ? item.quantity : 0), 0);

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const { state } = useStore();
  const { user } = useAuth();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [sortColumn, setSortColumn] = useState<OrderSortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const customer = state.customers.find(item => item.id === params.id);
  const canViewCustomer = customer && (user?.role !== "sale" || customer.assignedSaleId === user.id);
  const branches = useMemo(
    () => state.branches.filter(branch => branch.customerId === params.id),
    [state.branches, params.id],
  );
  const customerOrders = useMemo(
    () => state.orders.filter(order => order.customerId === params.id),
    [state.orders, params.id],
  );
  const activeOrders = useMemo(
    () => customerOrders.filter(order => order.status === "active"),
    [customerOrders],
  );

  const productSummary = (order: Order) => order.items.map(item => {
    const product = state.products.find(entry => entry.id === item.productId);
    return `${product?.name || "Sản phẩm"} ${formatNumber(item.quantity, 1)}${item.isGift ? " (tặng)" : ""}`;
  }).join(", ");

  const orders = useMemo(() => {
    const filtered = customerOrders.filter(order => {
      if (from && order.orderDate < from) return false;
      if (to && order.orderDate > to) return false;
      if (paymentFilter && order.paymentStatus !== paymentFilter) return false;
      return true;
    });

    const valueOf = (order: Order): string | number => {
      switch (sortColumn) {
        case "date": return `${order.orderDate} ${order.createdAt}`;
        case "code": return order.orderCode;
        case "branch": return state.branches.find(branch => branch.id === order.branchId)?.branchName || "";
        case "products": return productSummary(order);
        case "soldQty": return soldQtyOf(order);
        case "giftQty": return giftQtyOf(order);
        case "revenue": return order.revenue;
        case "ship": return order.shipFee;
        case "net": return order.revenueNet;
        case "payment": return PAYMENT_STATUS_LABEL[order.paymentStatus] || order.paymentStatus;
      }
    };

    return [...filtered].sort((leftOrder, rightOrder) => {
      const left = valueOf(leftOrder);
      const right = valueOf(rightOrder);
      const comparison = typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right), "vi", { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [customerOrders, state.branches, state.products, from, to, paymentFilter, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    const nextColumn = column as OrderSortColumn;
    if (nextColumn === sortColumn) {
      setSortDirection(current => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortColumn(nextColumn);
    setSortDirection(nextColumn === "date" ? "desc" : "asc");
  };

  if (!canViewCustomer) {
    return (
      <div className="space-y-4">
        <Link href="/customers" className="btn-ghost inline-flex"><ArrowLeft className="h-4 w-4" /> Danh sách khách hàng</Link>
        <div className="card"><EmptyState title="Không tìm thấy khách hàng" hint="Khách hàng không tồn tại hoặc bạn không có quyền xem." /></div>
      </div>
    );
  }

  const latestOrder = activeOrders.reduce<Order | null>((latest, order) => {
    if (!latest || `${order.orderDate} ${order.createdAt}` > `${latest.orderDate} ${latest.createdAt}`) return order;
    return latest;
  }, null);
  const totalSoldQty = activeOrders.reduce((sum, order) => sum + soldQtyOf(order), 0);
  const totalRevenue = activeOrders.reduce((sum, order) => sum + order.revenueNet, 0);
  const hasCompanyInfo = customer.companyName || customer.companyAddress || customer.companyPhone || customer.companyFax || customer.legalRepresentative;

  return (
    <div className="space-y-4">
      <Link href="/customers" className="btn-ghost inline-flex"><ArrowLeft className="h-4 w-4" /> Danh sách khách hàng</Link>

      <PageHeader
        title={customer.fullName}
        subtitle={`${customer.customerCode} · ${CUSTOMER_GROUP_LABEL[customer.customerGroup]}`}
        actions={<StatusBadge status={customer.status} />}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Đơn đã lấy" value={activeOrders.length} hint={`${customerOrders.filter(order => order.status === "cancelled").length} đơn đã huỷ`} icon={<ReceiptText className="h-4 w-4 text-blue-600" />} />
        <StatCard label="SL hàng bán" value={formatNumber(totalSoldQty, 1)} hint="Không gồm hàng tặng" icon={<PackageCheck className="h-4 w-4 text-emerald-600" />} />
        <StatCard label="Tổng giá trị đơn" value={formatMoney(totalRevenue)} hint="Sau chiết khấu và phí ship" icon={<Building2 className="h-4 w-4 text-violet-600" />} />
        <StatCard label="Lần lấy gần nhất" value={latestOrder ? formatDate(latestOrder.orderDate) : "—"} hint={latestOrder?.orderCode || "Chưa có đơn"} icon={<CalendarDays className="h-4 w-4 text-amber-600" />} />
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] gap-4">
        <section className="card p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Thông tin khách hàng</h2>
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
            <Info label="Tên khách hàng" value={customer.fullName} />
            <Info label="Mã khách hàng" value={customer.customerCode} />
            <Info label="Nhóm khách" value={CUSTOMER_GROUP_LABEL[customer.customerGroup]} />
            <Info label="Khu vực" value={customer.region} />
            <Info label="Điện thoại" value={customer.phone || "—"} />
            <Info label="Sale phụ trách" value={assigneeName(state.profiles, customer.assignedSaleId)} />
            <Info label="Người liên hệ" value={customer.contactName || "—"} />
            <Info label="SĐT người liên hệ" value={customer.contactPhone || "—"} />
            <Info label="Nguồn khách" value={customer.source || "—"} />
            <Info label="Ghi chú" value={customer.note || "—"} />
          </dl>

          {hasCompanyInfo && (
            <div className="border-t border-gray-200 mt-4 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Thông tin doanh nghiệp</h3>
              <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                <Info label="Tên công ty" value={customer.companyName || "—"} />
                <Info label="Điện thoại công ty" value={customer.companyPhone || "—"} />
                <Info label="Địa chỉ công ty" value={customer.companyAddress || "—"} />
                <Info label="Fax" value={customer.companyFax || "—"} />
                <Info label="Người đại diện" value={customer.legalRepresentative || "—"} />
                <Info label="Chức vụ" value={customer.legalRepresentativeTitle || "—"} />
              </dl>
            </div>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-900">Chi nhánh</h2>
            <span className="text-xs text-gray-500">{branches.length} chi nhánh</span>
          </div>
          {branches.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {branches.map(branch => {
                const due = isBranchDue(branch);
                return (
                  <div key={branch.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-gray-900">{branch.branchName}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{branch.branchCode}</div>
                      </div>
                      <StatusBadge status={branch.status} />
                    </div>
                    <div className="mt-3 text-sm text-gray-600 space-y-1">
                      <div className="flex items-start gap-2"><MapPin className="h-4 w-4 shrink-0 mt-0.5 text-gray-400" /><span>{branch.address}</span></div>
                      <div>Điện thoại: <b className="text-gray-800">{branch.phone || "—"}</b></div>
                      <div>Lấy gần nhất: {formatDate(branch.lastOrderDate) || "—"}</div>
                      <div>Dự kiến lấy tiếp: {formatDate(branch.estNextOrderDate) || "—"} {due && <span className="badge-red ml-1">Sắp/đã hết hàng</span>}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <EmptyState title="Chưa có chi nhánh" />}
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Lịch sử lấy đơn</h2>
            <p className="text-xs text-gray-500 mt-0.5">{orders.length} đơn trong phạm vi đang xem</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className="input w-40" value={from} onChange={event => setFrom(event.target.value)} aria-label="Từ ngày" />
            <span className="text-xs text-gray-500">→</span>
            <input type="date" className="input w-40" value={to} onChange={event => setTo(event.target.value)} aria-label="Đến ngày" />
            <select className="input w-40" value={paymentFilter} onChange={event => setPaymentFilter(event.target.value)} aria-label="Lọc thanh toán">
              <option value="">Tất cả thanh toán</option>
              {PAYMENT_FILTERS.map(status => <option key={status} value={status}>{PAYMENT_STATUS_LABEL[status]}</option>)}
            </select>
          </div>
        </div>

        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr>
              <SortableHeader label="Ngày / giờ" column="date" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
              <SortableHeader label="Mã đơn" column="code" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
              <SortableHeader label="Chi nhánh" column="branch" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
              <SortableHeader label="Sản phẩm" column="products" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
              <SortableHeader label="SL" column="soldQty" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
              <SortableHeader label="SL tặng" column="giftQty" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
              <SortableHeader label="Giá trị đơn" column="revenue" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
              <SortableHeader label="Ship" column="ship" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
              <SortableHeader label="Sau CK & ship" column="net" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
              <SortableHeader label="Thanh toán" column="payment" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
            </tr></thead>
            <tbody>
              {orders.map(order => {
                const branch = state.branches.find(entry => entry.id === order.branchId);
                return (
                  <tr key={order.id} className={order.status === "cancelled" ? "opacity-50" : ""}>
                    <td className="whitespace-nowrap">
                      <div>{formatDate(order.orderDate)}</div>
                      <div className="text-xs text-gray-500">{formatTime(order.createdAt)}</div>
                    </td>
                    <td className="font-medium text-brand-700 whitespace-nowrap">
                      {order.orderCode}
                      {order.status === "cancelled" && <div className="text-xs text-red-600">Đã huỷ</div>}
                    </td>
                    <td className="min-w-44">{branch?.branchName || "—"}</td>
                    <td className="min-w-64 text-sm">{productSummary(order)}</td>
                    <td className="text-right">{formatNumber(soldQtyOf(order), 1)}</td>
                    <td className="text-right">{formatNumber(giftQtyOf(order), 1)}</td>
                    <td className="text-right whitespace-nowrap">{formatMoney(order.revenue)}</td>
                    <td className="text-right whitespace-nowrap">{formatMoney(order.shipFee)}</td>
                    <td className="text-right font-medium whitespace-nowrap">{formatMoney(order.revenueNet)}</td>
                    <td><PaymentBadge status={order.paymentStatus} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {orders.length === 0 && <EmptyState title="Chưa có lịch sử lấy đơn" hint="Không có đơn hàng phù hợp với bộ lọc hiện tại." />}
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 mt-0.5 break-words">{value}</dd>
    </div>
  );
}
