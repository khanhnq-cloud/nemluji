"use client";
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatMoney, formatKg, formatPct, todayISO, addDays, daysBetween, CUSTOMER_GROUP_LABEL, LEAD_STATUS_LABEL } from "@/lib/utils";
import { isBranchDue } from "@/lib/forecast";
import { materialDaysLeft, materialStockValue } from "@/lib/production";
import { totalQty } from "@/lib/inventory";
import { receiptEffectiveDate, summarizeFinanceRange } from "@/lib/finance";
import {
  DollarSign, TrendingUp, Wallet, ShoppingCart, AlertTriangle,
  Factory, Package, Warehouse, HandCoins, Landmark, Clock3, Truck, CircleDollarSign,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

const COLORS = ["#f97316", "#0ea5e9", "#22c55e", "#a855f7", "#eab308", "#ec4899"];
type Preset = "today" | "7d" | "this_month" | "last_month" | "custom";

export default function DashboardPage() {
  const { state } = useStore();
  const { user } = useAuth();
  const showFin = can(user?.role, "view_financials"); // Net Revenue / Net Profit / Cost — chỉ admin
  const showExpenses = can(user?.role, "view_expenses");
  const showSales = can(user?.role, "view_orders"); // role Xưởng không xem doanh thu/bán hàng
  const [preset, setPreset] = useState<Preset>("this_month");
  const [compare, setCompare] = useState(false);
  const [cFrom, setCFrom] = useState(todayISO().slice(0, 8) + "01");
  const [cTo, setCTo] = useState(todayISO());

  const range = useMemo(() => {
    const today = todayISO();
    const d = new Date();
    if (preset === "today") return { from: today, to: today };
    if (preset === "7d") return { from: addDays(today, -6), to: today };
    if (preset === "this_month") return { from: today.slice(0, 8) + "01", to: today };
    if (preset === "last_month") {
      const f = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const t = new Date(d.getFullYear(), d.getMonth(), 0);
      return { from: f.toISOString().slice(0, 10), to: t.toISOString().slice(0, 10) };
    }
    return { from: cFrom, to: cTo };
  }, [preset, cFrom, cTo]);

  // Kỳ so sánh = cùng khoảng ngày tháng trước
  const prevRange = useMemo(() => {
    const shift = (iso: string) => { const x = new Date(iso); x.setMonth(x.getMonth() - 1); return x.toISOString().slice(0, 10); };
    return { from: shift(range.from), to: shift(range.to) };
  }, [range]);

  const myOrders = useMemo(() => {
    let os = state.orders.filter(o => o.status === "active");
    if (user?.role === "sale") os = os.filter(o => o.saleId === user.id);
    return os;
  }, [state.orders, user]);

  const myReceipts = useMemo(() => {
    if (user?.role !== "sale") return state.receipts;
    const orderIds = new Set(myOrders.map(order => order.id));
    return state.receipts.filter(receipt => receipt.orderId && orderIds.has(receipt.orderId));
  }, [state.receipts, myOrders, user?.role]);

  const inRange = (date: string, r: { from: string; to: string }) => date >= r.from && date <= r.to;

  const sum = (r: { from: string; to: string }) => {
    const os = myOrders.filter(o => inRange(o.orderDate, r));
    return {
      profit: os.reduce((s, o) => s + o.profitNet, 0),
      count: os.length,
    };
  };
  const cur = sum(range);
  const prev = sum(prevRange);
  const periodFinance = useMemo(
    () => summarizeFinanceRange(myOrders, myReceipts, range, state.expenses),
    [myOrders, myReceipts, range, state.expenses],
  );
  const previousFinance = useMemo(
    () => summarizeFinanceRange(myOrders, myReceipts, prevRange, state.expenses),
    [myOrders, myReceipts, prevRange, state.expenses],
  );
  const totalFinance = useMemo(
    () => summarizeFinanceRange(myOrders, myReceipts, { from: "0000-01-01", to: "9999-12-31" }),
    [myOrders, myReceipts],
  );

  const growth = (a: number, b: number) => b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / b) * 100;
  const totalPeriodCosts = periodFinance.totalCost;
  const previousTotalCosts = previousFinance.totalCost;

  const debtAmount = useMemo(
    () => myReceipts.filter(r => r.status === "pending" || r.status === "waiting_admin").reduce((s, r) => s + r.amount, 0),
    [myReceipts]
  );
  const dueBranches = useMemo(() => state.branches.filter(b => isBranchDue(b)).length, [state.branches]);

  const prod = useMemo(() => {
    const days = state.productionDays.filter(d => d.status === "closed" && inRange(d.productionDate, range));
    const batches = days.reduce((s, d) => s + d.batch1Count + d.batch2Count, 0);
    const output = days.reduce((s, d) => s + d.outputKg, 0);
    const avgLoss = days.length ? days.reduce((s, d) => s + d.lossPct, 0) / days.length : 0;
    const avgCost = days.length ? days.reduce((s, d) => s + d.costPerKg, 0) / days.length : 0;
    return { batches, output, avgLoss, avgCost };
  }, [state.productionDays, range]);

  const factoryStock = totalQty(state.factoryInventory);
  const clStock = totalQty(state.clInventory);
  const plannedBatches = state.settings.plannedBatchesPerDay || 8;
  const lowNvl = useMemo(() => state.materials.filter(m => m.isActive && materialDaysLeft(m, state.recipes.find(r => r.materialId === m.id), plannedBatches) < (m.warningDays || 3)).length, [state.materials, state.recipes, plannedBatches]);
  const nvlValue = useMemo(() => materialStockValue(state.materials), [state.materials]);

  // charts
  const dailyRevenue = useMemo(() => {
    const map = new Map<string, { actual: number; projected: number; prevActual: number; prevProjected: number }>();
    const span = Math.max(1, daysBetween(range.from, range.to) + 1);
    for (let i = 0; i < span && i < 62; i++) {
      const d = addDays(range.from, i);
      map.set(d.slice(5), { actual: 0, projected: 0, prevActual: 0, prevProjected: 0 });
    }
    myOrders.filter(o => inRange(o.orderDate, range)).forEach(o => {
      const k = o.orderDate.slice(5); const e = map.get(k); if (e) e.projected += o.revenueNet;
    });
    myReceipts.filter(r => r.status === "approved" && inRange(receiptEffectiveDate(r), range)).forEach(r => {
      const k = receiptEffectiveDate(r).slice(5); const e = map.get(k); if (e) e.actual += r.amount;
    });
    if (compare) {
      myOrders.filter(o => inRange(o.orderDate, prevRange)).forEach(o => {
        const x = new Date(o.orderDate); x.setMonth(x.getMonth() + 1);
        const k = x.toISOString().slice(5, 10); const e = map.get(k); if (e) e.prevProjected += o.revenueNet;
      });
      myReceipts.filter(r => r.status === "approved" && inRange(receiptEffectiveDate(r), prevRange)).forEach(r => {
        const x = new Date(receiptEffectiveDate(r)); x.setMonth(x.getMonth() + 1);
        const k = x.toISOString().slice(5, 10); const e = map.get(k); if (e) e.prevActual += r.amount;
      });
    }
    return Array.from(map.entries()).map(([label, values]) => ({ label, ...values }));
  }, [myOrders, myReceipts, range, prevRange, compare]);

  const bySale = useMemo(() => {
    const map: Record<string, number> = {};
    myOrders.filter(o => inRange(o.orderDate, range)).forEach(o => { map[o.saleId] = (map[o.saleId] || 0) + o.revenueNet; });
    return Object.entries(map).map(([id, v]) => ({ name: state.profiles.find(p => p.id === id)?.fullName || "—", value: v }));
  }, [myOrders, range, state.profiles]);

  const byGroup = useMemo(() => {
    const map: Record<string, number> = {};
    myOrders.filter(o => inRange(o.orderDate, range)).forEach(o => {
      const g = state.customers.find(c => c.id === o.customerId)?.customerGroup || "le";
      map[g] = (map[g] || 0) + o.revenueNet;
    });
    return Object.entries(map).map(([k, v]) => ({ name: CUSTOMER_GROUP_LABEL[k] || k, value: v }));
  }, [myOrders, range, state.customers]);

  const topCustomers = useMemo(() => {
    const map: Record<string, number> = {};
    myOrders.filter(o => inRange(o.orderDate, range)).forEach(o => { map[o.customerId] = (map[o.customerId] || 0) + o.revenueNet; });
    return Object.entries(map).map(([id, v]) => ({ name: state.customers.find(c => c.id === id)?.fullName || "—", value: v })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [myOrders, range, state.customers]);

  const leadFunnel = useMemo(() => Object.entries(LEAD_STATUS_LABEL).map(([k, v]) => ({ name: v, value: state.leads.filter(l => l.leadStatus === k).length })), [state.leads]);

  return (
    <div className="space-y-6">
      <PageHeader title={`Xin chào, ${user?.fullName}`} subtitle="Tổng quan hoạt động" />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Tổng quan hiện tại</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {showSales && <StatCard label="Tổng tiền đã thu" value={formatMoney(totalFinance.actualRevenue)} hint="Lũy kế phiếu thu đã duyệt" icon={<HandCoins className="h-4 w-4 text-emerald-600" />} tone="good" />}
          {showSales && <StatCard label="Tổng nợ tồn hiện tại" value={formatMoney(debtAmount)} hint="Tất cả phiếu thu chưa hoàn tất" icon={<Wallet className="h-4 w-4 text-amber-500" />} tone={debtAmount ? "warn" : "default"} />}
          <StatCard label="Tồn kho xưởng" value={formatKg(factoryStock)} icon={<Factory className="h-4 w-4 text-purple-500" />} />
          <StatCard label="Tồn kho Cát Linh" value={formatKg(clStock)} icon={<Warehouse className="h-4 w-4 text-blue-500" />} />
          {showFin && <StatCard label="Vốn NVL tồn xưởng" value={formatMoney(nvlValue)} icon={<Package className="h-4 w-4 text-gray-500" />} />}
          {showSales && <StatCard label="Khách sắp hết hàng" value={dueBranches} icon={<AlertTriangle className="h-4 w-4 text-red-500" />} tone={dueBranches ? "bad" : "default"} />}
          <StatCard label="NVL sắp hết" value={lowNvl} hint={`< ${state.settings.nvlWarningDays} ngày SX`} tone={lowNvl ? "bad" : "default"} />
        </div>
      </section>

      {showSales && (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Số liệu theo kỳ</h2>
        <div className="card p-3 flex flex-wrap gap-2 items-center">
          {([["today", "Hôm nay"], ["7d", "7 ngày"], ["this_month", "Tháng này"], ["last_month", "Tháng trước"], ["custom", "Tùy chọn"]] as [Preset, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setPreset(k)} className={`btn-sm rounded-md px-3 ${preset === k ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-700"}`}>{label}</button>
          ))}
          {preset === "custom" && (
            <>
              <input type="date" aria-label="Từ ngày" className="input w-40" value={cFrom} onChange={e => setCFrom(e.target.value)} />
              <span className="text-xs text-gray-500">→</span>
              <input type="date" aria-label="Đến ngày" className="input w-40" value={cTo} onChange={e => setCTo(e.target.value)} />
            </>
          )}
          <label className="flex items-center gap-2 text-sm ml-auto">
            <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} /> So sánh cùng kỳ tháng trước
          </label>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Doanh thu thực (tiền về)"
            value={formatMoney(periodFinance.actualRevenue)}
            hint={<><div>Tiền mặt {formatMoney(periodFinance.cashReceived)} · CK {formatMoney(periodFinance.bankReceived)}</div>{compare && <div>Cùng kỳ: {formatMoney(previousFinance.actualRevenue)} ({formatPct(growth(periodFinance.actualRevenue, previousFinance.actualRevenue))})</div>}</>}
            icon={<DollarSign className="h-4 w-4 text-emerald-500" />}
            tone="good"
          />
          <StatCard label="Doanh thu dự tính" value={formatMoney(periodFinance.projectedRevenue)} hint={compare ? `Cùng kỳ: ${formatMoney(previousFinance.projectedRevenue)} (${formatPct(growth(periodFinance.projectedRevenue, previousFinance.projectedRevenue))})` : "Gồm cả công nợ và chưa CK"} icon={<TrendingUp className="h-4 w-4 text-blue-500" />} />
          {showFin && <StatCard label="Lợi nhuận ròng" value={formatMoney(cur.profit)} hint={compare ? `Cùng kỳ: ${formatMoney(prev.profit)}` : undefined} icon={<TrendingUp className="h-4 w-4 text-emerald-500" />} />}
          <StatCard label="Đơn hàng" value={cur.count} hint={compare ? `Cùng kỳ: ${prev.count}` : undefined} icon={<ShoppingCart className="h-4 w-4 text-blue-500" />} />
          <StatCard label="Nợ ngắn hạn phát sinh" value={formatMoney(periodFinance.shortTermDebt)} hint="Đơn chưa chuyển khoản trong kỳ" icon={<Clock3 className="h-4 w-4 text-amber-500" />} tone={periodFinance.shortTermDebt ? "warn" : "default"} />
          <StatCard label="Nợ dài hạn phát sinh" value={formatMoney(periodFinance.longTermDebt)} hint="Đơn công nợ trong kỳ" icon={<Landmark className="h-4 w-4 text-red-500" />} tone={periodFinance.longTermDebt ? "bad" : "default"} />
          <StatCard label="Tiền ship" value={formatMoney(periodFinance.shipping)} hint={`${periodFinance.shippingOrderCount} đơn có phí ship`} icon={<Truck className="h-4 w-4 text-blue-500" />} />
          {showExpenses && <StatCard label="Phiếu chi" value={formatMoney(periodFinance.expenses)} hint={`${periodFinance.expenseCount} phiếu trong kỳ`} icon={<Wallet className="h-4 w-4 text-red-500" />} tone={periodFinance.expenses ? "bad" : "default"} />}
          {showExpenses && <StatCard label="Tổng chi phí" value={formatMoney(totalPeriodCosts)} hint={<><div>Ship {formatMoney(periodFinance.shippingCost)} · Phiếu chi {formatMoney(periodFinance.expenses)}</div>{compare && <div>Cùng kỳ: {formatMoney(previousTotalCosts)}</div>}</>} icon={<CircleDollarSign className="h-4 w-4 text-orange-600" />} tone={totalPeriodCosts ? "bad" : "default"} />}
          {showExpenses && <StatCard label="Tổng tiền (thực thu − chi phí)" value={formatMoney(periodFinance.netCash)} hint={compare ? `Cùng kỳ: ${formatMoney(previousFinance.netCash)}` : "Tiền hàng nhận về − tổng chi phí"} icon={<CircleDollarSign className="h-4 w-4 text-emerald-600" />} tone={periodFinance.netCash < 0 ? "bad" : "good"} />}
          <StatCard label="Mẻ sản xuất" value={prod.batches} hint={`${formatKg(prod.output)} thành phẩm`} icon={<Factory className="h-4 w-4 text-purple-500" />} />
          <StatCard label="% hao hụt TB" value={formatPct(prod.avgLoss)} hint={showFin ? `Cost/kg: ${formatMoney(prod.avgCost)}` : undefined} />
        </div>
      </section>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {showFin && (
        <div className="card p-4 lg:col-span-2">
          <div className="text-sm font-semibold mb-3">Doanh thu thực và dự tính theo ngày {compare && "— so cùng kỳ"}</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dailyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1_000_000).toFixed(0)}tr`} />
              <Tooltip formatter={(v: any) => formatMoney(Number(v))} />
              {compare && <Legend />}
              <Line type="monotone" dataKey="actual" name="Thực thu" stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="projected" name="Dự tính" stroke="#f97316" strokeWidth={2} dot={false} />
              {compare && <Line type="monotone" dataKey="prevActual" name="Thực thu cùng kỳ" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />}
              {compare && <Line type="monotone" dataKey="prevProjected" name="Dự tính cùng kỳ" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
        )}

        {showFin && (
        <div className="card p-4">
          <div className="text-sm font-semibold mb-3">Doanh thu dự tính theo nhóm khách</div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={byGroup} dataKey="value" nameKey="name" outerRadius={90} label={(e: any) => e.name}>
                {byGroup.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => formatMoney(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        )}

        {showFin && (
        <div className="card p-4">
          <div className="text-sm font-semibold mb-3">Doanh thu dự tính theo sale</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={bySale}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1_000_000).toFixed(0)}tr`} />
              <Tooltip formatter={(v: any) => formatMoney(Number(v))} />
              <Bar dataKey="value" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {showFin && (
        <div className="card p-4">
          <div className="text-sm font-semibold mb-3">Top 10 khách theo doanh thu dự tính</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topCustomers} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1_000_000).toFixed(0)}tr`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
              <Tooltip formatter={(v: any) => formatMoney(Number(v))} />
              <Bar dataKey="value" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

      </div>

      {showSales && (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Hiện trạng khách hàng</h2>
        <div className="card p-4">
          <div className="text-sm font-semibold mb-3">Trạng thái lead hiện tại</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={leadFunnel} dataKey="value" nameKey="name" outerRadius={80} label>
                {leadFunnel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>
      )}
    </div>
  );
}
