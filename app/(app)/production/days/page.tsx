"use client";
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { StatusBadge } from "@/components/Badge";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { computeUsages, computeBatchResult, batchesRemaining } from "@/lib/production";
import { adjustInventory, totalQty } from "@/lib/inventory";
import { formatDate, formatMoney, formatKg, formatPct, nextSequentialCode, newId, todayISO } from "@/lib/utils";
import { Plus, Eye, Lock, AlertTriangle } from "lucide-react";
import type { ProductionDay, StockTransfer } from "@/types";

export default function ProductionDaysPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const showFin = can(user?.role, "view_financials"); // Cost/kg, tổng CP — chỉ admin
  const [open, setOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  type Form = {
    productionDate: string; batch1Count: number; batch2Count: number;
    outputKg: number; outputProductId: string; transferToClKg: number;
    extraCostFactory: number; note?: string;
  };
  const blank = (): Form => ({
    productionDate: todayISO(), batch1Count: 0, batch2Count: 0,
    outputKg: 0, outputProductId: state.products[0]?.id || "", transferToClKg: 0,
    extraCostFactory: 0,
  });
  const [form, setForm] = useState<Form>(blank());

  const usages = useMemo(
    () => computeUsages(form.batch1Count, form.batch2Count, state.recipes, state.materials),
    [form.batch1Count, form.batch2Count, state.recipes, state.materials]
  );
  const result = useMemo(() => computeBatchResult(usages, form.outputKg), [usages, form.outputKg]);
  const remaining = useMemo(() => batchesRemaining(state.materials, state.recipes), [state.materials, state.recipes]);

  const previewRows = useMemo(() => usages.map(u => {
    const mat = state.materials.find(m => m.id === u.materialId)!;
    return { mat, before: mat.qty, deduct: u.usedQty, after: +(mat.qty - u.usedQty).toFixed(2) };
  }), [usages, state.materials]);
  const hasNegative = previewRows.some(r => r.after < 0);

  const lastFactoryStock = useMemo(() => totalQty(state.factoryInventory), [state.factoryInventory]);

  const closeDay = () => {
    if (form.batch1Count <= 0 && form.batch2Count <= 0) { alert("Nhập số mẻ"); return; }
    if (form.outputKg <= 0) { alert("Nhập kg thành phẩm"); return; }
    if (!form.outputProductId) { alert("Chọn sản phẩm thành phẩm"); return; }
    if (state.productionDays.some(d => d.productionDate === form.productionDate)) { alert("Ngày sản xuất này đã tồn tại"); return; }
    if (hasNegative) { alert("Không thể chốt: tồn NVL sẽ âm. Cần nhập thêm NVL."); return; }
    if (form.transferToClKg > form.outputKg) { alert("Chuyển kho không thể lớn hơn sản lượng"); return; }

    update(s => {
      // 1) trừ lùi NVL theo định mức
      const materials = s.materials.map(m => {
        const u = usages.find(x => x.materialId === m.id);
        return u ? { ...m, qty: +(m.qty - u.usedQty).toFixed(2) } : m;
      });
      // 2) cộng thành phẩm vào TỒN KHO XƯỞNG, rồi trừ phần chuyển đi
      let factoryInventory = adjustInventory(s.factoryInventory, form.outputProductId, form.outputKg);
      let transfers = s.transfers;
      if (form.transferToClKg > 0) {
        factoryInventory = adjustInventory(factoryInventory, form.outputProductId, -form.transferToClKg);
        const t: StockTransfer = {
          id: newId(), transferCode: nextSequentialCode("TR", s.transfers.map(t => t.transferCode)), transferDate: form.productionDate,
          productId: form.outputProductId, qtyKg: form.transferToClKg, status: "pending",
        };
        transfers = [t, ...transfers];
      }
      const factoryStockKgEnd = totalQty(factoryInventory);
      const day: ProductionDay = {
        id: newId(), productionCode: nextSequentialCode("PSX", s.productionDays.map(d => d.productionCode)), productionDate: form.productionDate,
        batch1Count: form.batch1Count, batch2Count: form.batch2Count, outputKg: form.outputKg,
        transferToClKg: form.transferToClKg, factoryStockKgEnd,
        lossKg: result.lossKg, lossPct: result.lossPct, costPerKg: result.costPerKg,
        extraCostFactory: form.extraCostFactory, usages, status: "closed",
        closedBy: user!.id, closedAt: todayISO(), note: form.note,
      };
      return { ...s, productionDays: [day, ...s.productionDays], materials, factoryInventory, transfers };
    });
    setOpen(false); setShowPreview(false); setForm(blank());
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mẻ sản xuất (Xưởng Đông Anh)"
        subtitle="Mẻ 1 (đánh giò + ủ lạnh) + Mẻ 2 (trộn + nướng) — trừ lùi NVL theo định mức"
        actions={can(user?.role, "manage_production") && <button className="btn-primary" onClick={() => { setForm(blank()); setShowPreview(false); setOpen(true); }}><Plus className="h-4 w-4" /> Tạo ngày sản xuất</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Số mẻ còn làm được" value={remaining} hint="Với tồn NVL hiện tại" tone={remaining < 3 ? "bad" : "default"} />
        <StatCard label="Tồn kho xưởng" value={formatKg(lastFactoryStock)} />
        <StatCard label="Ngày SX đã chốt" value={state.productionDays.filter(d => d.status === "closed").length} />
        <StatCard label="Tổng mẻ tháng" value={state.productionDays.filter(d => d.productionDate.startsWith(todayISO().slice(0,7))).reduce((s, d) => s + d.batch1Count + d.batch2Count, 0)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr>
            <th>Mã</th><th>Ngày</th><th className="text-right">Mẻ 1</th><th className="text-right">Mẻ 2</th>
            <th className="text-right">Output</th><th className="text-right">Chuyển CL</th><th className="text-right">Tồn xưởng</th>
            <th className="text-right">Hao hụt</th>{showFin && <th className="text-right">Cost/kg</th>}<th>Trạng thái</th>
          </tr></thead>
          <tbody>
            {state.productionDays.map(d => (
              <tr key={d.id}>
                <td className="font-medium">{d.productionCode}</td>
                <td>{formatDate(d.productionDate)}</td>
                <td className="text-right">{d.batch1Count}</td>
                <td className="text-right">{d.batch2Count}</td>
                <td className="text-right">{formatKg(d.outputKg)}</td>
                <td className="text-right">{formatKg(d.transferToClKg)}</td>
                <td className="text-right">{formatKg(d.factoryStockKgEnd)}</td>
                <td className="text-right">{formatKg(d.lossKg)} ({formatPct(d.lossPct)})</td>
                {showFin && <td className="text-right">{formatMoney(d.costPerKg)}</td>}
                <td><StatusBadge status={d.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {state.productionDays.length === 0 && <EmptyState />}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Tạo ngày sản xuất" size="xl" footer={
        <>
          <button className="btn-secondary" onClick={() => setOpen(false)}>Huỷ</button>
          <button className="btn-secondary" onClick={() => setShowPreview(true)}><Eye className="h-4 w-4" /> Xem trước trừ NVL</button>
          <button className="btn-primary" onClick={closeDay}><Lock className="h-4 w-4" /> Chốt ngày</button>
        </>
      }>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className="label">Ngày sản xuất *</label><input type="date" className="input" value={form.productionDate} max={todayISO()} onChange={e => setForm(f => ({ ...f, productionDate: e.target.value }))} /></div>
            <div><label className="label">Số mẻ 1 (đánh giò)</label><input type="number" className="input" value={form.batch1Count} onChange={e => setForm(f => ({ ...f, batch1Count: Number(e.target.value) }))} /></div>
            <div><label className="label">Số mẻ 2 (trộn + nướng)</label><input type="number" className="input" value={form.batch2Count} onChange={e => setForm(f => ({ ...f, batch2Count: Number(e.target.value) }))} /></div>
            <div>
              <label className="label">Sản phẩm thành phẩm *</label>
              <select className="input" value={form.outputProductId} onChange={e => setForm(f => ({ ...f, outputProductId: e.target.value }))}>
                {state.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className="label">Output thành phẩm (kg) *</label><input type="number" step="0.1" className="input" value={form.outputKg} onChange={e => setForm(f => ({ ...f, outputKg: Number(e.target.value) }))} /></div>
            <div><label className="label">Chuyển về kho CL (kg)</label><input type="number" step="0.1" className="input" value={form.transferToClKg} onChange={e => setForm(f => ({ ...f, transferToClKg: Number(e.target.value) }))} /></div>
            <div><label className="label">Chi phí lặt vặt xưởng (đ)</label><input type="number" className="input" value={form.extraCostFactory} onChange={e => setForm(f => ({ ...f, extraCostFactory: Number(e.target.value) }))} /></div>
            <div className="sm:col-span-2"><label className="label">Ghi chú</label><input className="input" value={form.note || ""} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></div>
          </div>

          {showPreview && (
            <div className="border border-gray-200 rounded-md">
              <div className="px-3 py-2 bg-gray-50 border-b text-sm font-semibold flex items-center justify-between">
                <span>Xem trước trừ NVL</span>
                {hasNegative && <span className="badge-red flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Tồn sẽ âm — không thể chốt</span>}
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="table-base">
                  <thead><tr><th>NVL</th><th className="text-right">Tồn trước</th><th className="text-right">Sẽ trừ</th><th className="text-right">Tồn sau</th></tr></thead>
                  <tbody>
                    {previewRows.map(r => (
                      <tr key={r.mat.id} className={r.after < 0 ? "bg-red-50" : ""}>
                        <td>{r.mat.name}</td>
                        <td className="text-right">{r.before} {r.mat.unit}</td>
                        <td className="text-right">{r.deduct} {r.mat.unit}</td>
                        <td className={`text-right font-medium ${r.after < 0 ? "text-red-600" : ""}`}>{r.after} {r.mat.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-md p-3 grid sm:grid-cols-4 gap-3 text-sm">
            {showFin && <div><div className="text-gray-500 text-xs">Tổng CP NVL</div><div className="font-semibold">{formatMoney(result.totalMaterialCost)}</div></div>}
            <div><div className="text-gray-500 text-xs">Expected output</div><div className="font-semibold">{formatKg(result.expectedOutput)}</div></div>
            <div><div className="text-gray-500 text-xs">Hao hụt</div><div className="font-semibold">{formatKg(result.lossKg)} ({formatPct(result.lossPct)})</div></div>
            {showFin && <div><div className="text-gray-500 text-xs">Cost/kg</div><div className="font-semibold text-emerald-700">{formatMoney(result.costPerKg)}</div></div>}
          </div>
        </div>
      </Modal>
    </div>
  );
}
