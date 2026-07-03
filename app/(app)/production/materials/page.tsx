"use client";
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { avgBatchesPerDay, materialDaysLeft, materialStockValue, batchesRemaining } from "@/lib/production";
import { formatMoney, formatNumber } from "@/lib/utils";
import { PackagePlus } from "lucide-react";

export default function MaterialsPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const [openImport, setOpenImport] = useState<string | null>(null);
  const [impQty, setImpQty] = useState(0);
  const [impPrice, setImpPrice] = useState(0);

  const avg = useMemo(() => avgBatchesPerDay(state.productionDays), [state.productionDays]);
  const stockValue = useMemo(() => materialStockValue(state.materials), [state.materials]);
  const remaining = useMemo(() => batchesRemaining(state.materials, state.recipes), [state.materials, state.recipes]);

  const rows = useMemo(() => state.materials.map(m => {
    const recipe = state.recipes.find(r => r.materialId === m.id);
    const daysLeft = materialDaysLeft(m, recipe, avg);
    return { m, recipe, daysLeft, warn: daysLeft < (m.warningDays || 3) };
  }), [state.materials, state.recipes, avg]);

  const lowCount = rows.filter(r => r.warn).length;

  const doImport = () => {
    if (!openImport || impQty <= 0) { alert("Nhập số lượng"); return; }
    update(s => ({
      ...s,
      materials: s.materials.map(m => m.id === openImport ? {
        ...m, qty: +(m.qty + impQty).toFixed(2), unitPrice: impPrice > 0 ? impPrice : m.unitPrice,
      } : m),
    }));
    setOpenImport(null); setImpQty(0); setImpPrice(0);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Nguyên liệu & Tồn kho xưởng" subtitle="Định mức theo mẻ + cảnh báo NVL sắp hết" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Vốn NVL tồn xưởng" value={formatMoney(stockValue)} />
        <StatCard label="Số mẻ còn làm được" value={remaining} tone={remaining < 3 ? "bad" : "good"} />
        <StatCard label="NVL sắp hết (<3 ngày)" value={lowCount} tone={lowCount ? "bad" : "default"} />
        <StatCard label="Mẻ TB/ngày" value={formatNumber(avg, 1)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr>
            <th>NVL</th><th>Đơn vị</th><th className="text-right">Tồn</th><th className="text-right">Giá/đv</th>
            <th className="text-right">Vốn tồn</th><th className="text-right">ĐM mẻ 1</th><th className="text-right">ĐM mẻ 2</th>
            <th className="text-right">Còn dùng được</th><th>Cảnh báo</th><th></th>
          </tr></thead>
          <tbody>
            {rows.map(({ m, recipe, daysLeft, warn }) => (
              <tr key={m.id} className={warn ? "bg-red-50/30" : ""}>
                <td className="font-medium">{m.name}</td>
                <td>{m.unit}</td>
                <td className="text-right">{formatNumber(m.qty, 2)}</td>
                <td className="text-right">{formatMoney(m.unitPrice)}</td>
                <td className="text-right">{formatMoney(m.qty * m.unitPrice)}</td>
                <td className="text-right">{recipe?.batch1Rate || 0}</td>
                <td className="text-right">{recipe?.batch2Rate || 0}</td>
                <td className="text-right font-medium">{daysLeft >= 999 ? "—" : `${daysLeft} ngày`}</td>
                <td>{warn && <span className="badge-red">Sắp hết</span>}</td>
                <td>
                  {can(user?.role, "manage_materials") && (
                    <button className="btn-ghost btn-sm" onClick={() => { setOpenImport(m.id); setImpPrice(m.unitPrice); }}>
                      <PackagePlus className="h-3.5 w-3.5" /> Nhập
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!openImport} onClose={() => setOpenImport(null)} title="Nhập thêm NVL" size="sm" footer={
        <>
          <button className="btn-secondary" onClick={() => setOpenImport(null)}>Huỷ</button>
          <button className="btn-primary" onClick={doImport}>Nhập kho</button>
        </>
      }>
        <div className="space-y-3">
          <div className="text-sm">NVL: <b>{state.materials.find(m => m.id === openImport)?.name}</b></div>
          <div><label className="label">Số lượng nhập</label><input type="number" step="0.1" className="input" value={impQty} onChange={e => setImpQty(Number(e.target.value))} /></div>
          <div><label className="label">Giá/đơn vị (cập nhật)</label><input type="number" className="input" value={impPrice} onChange={e => setImpPrice(Number(e.target.value))} /></div>
        </div>
      </Modal>
    </div>
  );
}
