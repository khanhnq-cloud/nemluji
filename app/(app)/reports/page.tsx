"use client";
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatMoney, formatKg, formatPct, monthISO, CUSTOMER_GROUP_LABEL } from "@/lib/utils";
import { Download, Lock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";

export default function ReportsPage() {
  const { state } = useStore();
  const { user } = useAuth();
  const showFin = can(user?.role, "view_financials"); // Net Revenue / Net Profit / Cost — chỉ admin
  const [period, setPeriod] = useState(monthISO());

  const prevPeriod = useMemo(() => {
    const [y, m] = period.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return d.toISOString().slice(0, 7);
  }, [period]);

  const agg = (mk: string) => {
    const os = state.orders.filter(o => o.status === "active" && o.orderDate.startsWith(mk));
    return {
      revenue: os.reduce((s, o) => s + o.revenue, 0),
      net: os.reduce((s, o) => s + o.revenueNet, 0),
      cost: os.reduce((s, o) => s + o.cost, 0),
      profit: os.reduce((s, o) => s + o.profitNet, 0),
      count: os.length,
    };
  };
  const cur = agg(period);
  const prev = agg(prevPeriod);
  const growth = (a: number, b: number) => b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / b) * 100;

  const bySale = useMemo(() => {
    const map: Record<string, number> = {};
    state.orders.filter(o => o.status === "active" && o.orderDate.startsWith(period)).forEach(o => { map[o.saleId] = (map[o.saleId] || 0) + o.revenueNet; });
    return Object.entries(map).map(([id, v]) => ({ name: state.profiles.find(p => p.id === id)?.fullName || "—", value: v }));
  }, [state, period]);

  const byGroup = useMemo(() => {
    const map: Record<string, number> = {};
    state.orders.filter(o => o.status === "active" && o.orderDate.startsWith(period)).forEach(o => {
      const g = state.customers.find(c => c.id === o.customerId)?.customerGroup || "le";
      map[g] = (map[g] || 0) + o.revenueNet;
    });
    return Object.entries(map).map(([k, v]) => ({ name: CUSTOMER_GROUP_LABEL[k] || k, value: v }));
  }, [state, period]);

  const costPerKg = useMemo(() =>
    state.productionDays.filter(d => d.status === "closed" && d.productionDate.startsWith(period))
      .sort((a, b) => a.productionDate.localeCompare(b.productionDate))
      .map(d => ({ label: d.productionDate.slice(5), cost: d.costPerKg, loss: d.lossPct })),
  [state.productionDays, period]);

  const exportCSV = () => {
    const lines = [
      `Báo cáo tháng ${period}`, "",
      `Doanh thu,${cur.revenue}`,
      ...(showFin ? [`Net Revenue,${cur.net}`, `Cost,${cur.cost}`, `Net Profit,${cur.profit}`,
        `Tăng trưởng net vs ${prevPeriod},${growth(cur.net, prev.net).toFixed(1)}%`] : []),
      "",
      ...(showFin ? ["Doanh thu theo sale", "Sale,Net Revenue", ...bySale.map(r => `${r.name},${r.value}`)] : []),
    ];
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `bao-cao-${period}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Báo cáo"
        subtitle={`Tháng ${period} (so cùng kỳ ${prevPeriod})`}
        actions={
          <>
            <input type="month" className="input w-44" value={period} onChange={e => setPeriod(e.target.value)} />
            <button className="btn-secondary" onClick={exportCSV}><Download className="h-4 w-4" /> Xuất CSV</button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Doanh thu" value={formatMoney(cur.revenue)} hint={`${formatPct(growth(cur.revenue, prev.revenue))} vs cùng kỳ`} />
        {showFin && <StatCard label="Net Revenue" value={formatMoney(cur.net)} hint={`${formatPct(growth(cur.net, prev.net))} vs cùng kỳ`} tone="good" />}
        {showFin && <StatCard label="Cost" value={formatMoney(cur.cost)} />}
        {showFin && <StatCard label="Net Profit" value={formatMoney(cur.profit)} hint={`${formatPct(growth(cur.profit, prev.profit))} vs cùng kỳ`} />}
      </div>

      {!showFin && (
        <div className="card p-6"><EmptyState title="Báo cáo Net Revenue / Cost / Net Profit chỉ Admin xem được" hint="Bạn vẫn xem được tổng doanh thu phía trên." /></div>
      )}

      {showFin && (
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-sm font-semibold mb-3">Doanh thu theo sale</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={bySale}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1_000_000).toFixed(0)}tr`} />
              <Tooltip formatter={(v: any) => formatMoney(Number(v))} />
              <Bar dataKey="value" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <div className="text-sm font-semibold mb-3">Doanh thu theo nhóm khách</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byGroup}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1_000_000).toFixed(0)}tr`} />
              <Tooltip formatter={(v: any) => formatMoney(Number(v))} />
              <Bar dataKey="value" fill="#22c55e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4 lg:col-span-2">
          <div className="text-sm font-semibold mb-3">Cost/kg & % hao hụt theo ngày sản xuất</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={costPerKg}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="l" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
              <Tooltip />
              <Line yAxisId="l" type="monotone" dataKey="cost" name="Cost/kg" stroke="#f97316" strokeWidth={2} />
              <Line yAxisId="r" type="monotone" dataKey="loss" name="% hao hụt" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      )}
    </div>
  );
}
