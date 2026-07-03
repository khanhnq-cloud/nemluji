"use client";
import { useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { formatMoney, formatPct, LEAD_STATUS_LABEL } from "@/lib/utils";

export default function SamplesPage() {
  const { state } = useStore();
  const { user } = useAuth();
  const isSale = user?.role === "sale";

  const leads = useMemo(() => state.leads.filter(l => !isSale || l.saleId === user?.id), [state.leads, isSale, user]);

  const bySale = useMemo(() => {
    const sales = state.profiles.filter(p => p.role === "sale");
    return sales
      .filter(p => !isSale || p.id === user?.id)
      .map(p => {
        const my = leads.filter(l => l.saleId === p.id);
        const won = my.filter(l => l.leadStatus === "da_chot").length;
        return {
          id: p.id, name: p.fullName,
          leadCount: my.length,
          won,
          convRate: my.length ? won / my.length * 100 : 0,
          sampleQty: my.reduce((s, l) => s + l.sampleQtyTotal, 0),
          sampleCost: my.reduce((s, l) => s + l.sampleCostTotal, 0),
        };
      });
  }, [leads, state.profiles, isSale, user]);

  const totalSampleCost = bySale.reduce((s, r) => s + r.sampleCost, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Hàng phát thử & Phễu chuyển đổi" subtitle="Tổng hợp chi phí hàng mẫu theo sale" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Tổng lead" value={leads.length} />
        <StatCard label="Đã chốt" value={leads.filter(l => l.leadStatus === "da_chot").length} tone="good" />
        <StatCard label="Tổng cost hàng mẫu" value={formatMoney(totalSampleCost)} tone="warn" />
        <StatCard label="Tỷ lệ chốt TB" value={formatPct(leads.length ? leads.filter(l => l.leadStatus === "da_chot").length / leads.length * 100 : 0)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr>
            <th>Sale</th><th className="text-right">Lead</th><th className="text-right">Chốt</th>
            <th className="text-right">Tỷ lệ chốt</th><th className="text-right">SL hàng mẫu</th><th className="text-right">Cost hàng mẫu</th>
          </tr></thead>
          <tbody>
            {bySale.map(r => (
              <tr key={r.id}>
                <td className="font-medium">{r.name}</td>
                <td className="text-right">{r.leadCount}</td>
                <td className="text-right">{r.won}</td>
                <td className="text-right">{formatPct(r.convRate)}</td>
                <td className="text-right">{r.sampleQty}</td>
                <td className="text-right font-medium">{formatMoney(r.sampleCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {bySale.length === 0 && <EmptyState />}
      </div>

      <div className="card p-4">
        <div className="text-sm font-semibold mb-3">Phễu trạng thái lead</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {Object.entries(LEAD_STATUS_LABEL).map(([k, v]) => {
            const count = leads.filter(l => l.leadStatus === k).length;
            return (
              <div key={k} className="border border-gray-200 rounded-md p-3 text-center">
                <div className="text-2xl font-semibold">{count}</div>
                <div className="text-xs text-gray-500 mt-1">{v}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
