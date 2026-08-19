"use client";
import React, { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { StatusBadge } from "@/components/Badge";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { computeUsages, computeBatchResult, batchesRemaining } from "@/lib/production";
import { adjustInventory, invQty, totalQty } from "@/lib/inventory";
import { formatDate, formatMoney, formatKg, formatNumber, formatPct, nextSequentialCode, newId, todayISO } from "@/lib/utils";
import { Plus, Eye, Lock, AlertTriangle } from "lucide-react";
import type { ProductionDay, StockTransfer, ProductQty, MaterialQty } from "@/types";

export default function ProductionDaysPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const showFin = can(user?.role, "view_financials");
  const canManage = can(user?.role, "manage_production");
  const [open, setOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { standardOutputPerBatch2, materialCostPerBatch2 } = state.settings;

  // NVL đang bật, sắp theo thứ tự cột sổ
  const activeMaterials = useMemo(
    () => state.materials.filter(m => m.isActive).sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)),
    [state.materials],
  );
  // Thành phẩm là output của xưởng (TT/TTC/Ngắn/Vụn...)
  const outputProducts = useMemo(
    () => state.products.filter(p => p.isActive && p.isFactoryOutput),
    [state.products],
  );

  type Form = {
    productionDate: string; batch1Count: number; batch2Count: number;
    outputs: Record<string, number>; transfersOut: Record<string, number>;
    extraCostFactory: number; note?: string;
  };
  const blank = (): Form => ({
    productionDate: todayISO(), batch1Count: 0, batch2Count: 0,
    outputs: {}, transfersOut: {}, extraCostFactory: 0,
  });
  const [form, setForm] = useState<Form>(blank());

  const usages = useMemo(
    () => computeUsages(form.batch1Count, form.batch2Count, state.recipes, state.materials),
    [form.batch1Count, form.batch2Count, state.recipes, state.materials],
  );
  const outputTotal = useMemo(() => outputProducts.reduce((s, p) => s + (form.outputs[p.id] || 0), 0), [outputProducts, form.outputs]);
  const transferTotal = useMemo(() => outputProducts.reduce((s, p) => s + (form.transfersOut[p.id] || 0), 0), [outputProducts, form.transfersOut]);
  const result = useMemo(
    () => computeBatchResult(usages, outputTotal, form.batch2Count, standardOutputPerBatch2, materialCostPerBatch2),
    [usages, outputTotal, form.batch2Count, standardOutputPerBatch2, materialCostPerBatch2],
  );
  const remaining = useMemo(() => batchesRemaining(state.materials, state.recipes), [state.materials, state.recipes]);

  const previewRows = useMemo(() => usages.map(u => {
    const mat = state.materials.find(m => m.id === u.materialId)!;
    return { mat, before: mat.qty, deduct: u.usedQty, after: +(mat.qty - u.usedQty).toFixed(2) };
  }), [usages, state.materials]);
  const hasNegative = previewRows.some(r => r.after < 0);

  const factoryStock = useMemo(() => totalQty(state.factoryInventory), [state.factoryInventory]);

  const closeDay = () => {
    if (form.batch1Count <= 0 && form.batch2Count <= 0) { alert("Nhập số mẻ"); return; }
    if (outputTotal <= 0) { alert("Nhập kg thành phẩm (Ra thành phẩm)"); return; }
    if (state.productionDays.some(d => d.productionDate === form.productionDate)) { alert("Ngày sản xuất này đã tồn tại"); return; }
    if (hasNegative) { alert("Không thể chốt: tồn NVL sẽ âm. Cần nhập thêm NVL."); return; }
    for (const p of outputProducts) {
      const out = form.outputs[p.id] || 0;
      const open = invQty(state.factoryInventory, p.id);
      const away = form.transfersOut[p.id] || 0;
      if (away > out + open) { alert(`Về CL của ${p.name} vượt tồn khả dụng (Ra ${out} + Kho ${open} kg)`); return; }
    }

    update(s => {
      // 1) trừ lùi NVL theo định mức + snapshot tồn đầu/cuối
      const materialOpening: MaterialQty[] = activeMaterials.map(m => ({ materialId: m.id, qty: m.qty }));
      const materials = s.materials.map(m => {
        const u = usages.find(x => x.materialId === m.id);
        return u ? { ...m, qty: +(m.qty - u.usedQty).toFixed(2) } : m;
      });
      const materialClosing: MaterialQty[] = activeMaterials.map(m => {
        const u = usages.find(x => x.materialId === m.id);
        return { materialId: m.id, qty: +(m.qty - (u?.usedQty || 0)).toFixed(2) };
      });
      const materialStockValueEnd = materialClosing.reduce((sum, mc) => {
        const mat = s.materials.find(m => m.id === mc.materialId);
        return sum + mc.qty * (mat?.unitPrice || 0);
      }, 0);

      // 2) tồn thành phẩm theo loại: đầu → +output → −chuyển
      const factoryStockOpen: ProductQty[] = outputProducts.map(p => ({ productId: p.id, qtyKg: invQty(s.factoryInventory, p.id) }));
      const outputs: ProductQty[] = outputProducts.map(p => ({ productId: p.id, qtyKg: form.outputs[p.id] || 0 })).filter(x => x.qtyKg > 0);
      const transfersOut: ProductQty[] = outputProducts.map(p => ({ productId: p.id, qtyKg: form.transfersOut[p.id] || 0 })).filter(x => x.qtyKg > 0);

      let factoryInventory = s.factoryInventory;
      for (const o of outputs) factoryInventory = adjustInventory(factoryInventory, o.productId, o.qtyKg);
      for (const t of transfersOut) factoryInventory = adjustInventory(factoryInventory, t.productId, -t.qtyKg);

      const factoryStockEnd: ProductQty[] = outputProducts.map(p => ({ productId: p.id, qtyKg: invQty(factoryInventory, p.id) }));

      // 3) phiếu chuyển kho (mỗi loại 1 phiếu, chờ Kho Cát Linh xác nhận)
      let transfers = s.transfers;
      for (const t of transfersOut) {
        const tr: StockTransfer = {
          id: newId(), transferCode: nextSequentialCode("TR", transfers.map(x => x.transferCode)),
          transferDate: form.productionDate, productId: t.productId, qtyKg: t.qtyKg,
          status: "pending", direction: "factory_to_cl",
        };
        transfers = [tr, ...transfers];
      }

      const day: ProductionDay = {
        id: newId(), productionCode: nextSequentialCode("PSX", s.productionDays.map(d => d.productionCode)), productionDate: form.productionDate,
        batch1Count: form.batch1Count, batch2Count: form.batch2Count,
        outputKg: +outputTotal.toFixed(2), transferToClKg: +transferTotal.toFixed(2), factoryStockKgEnd: totalQty(factoryInventory),
        lossKg: result.lossKg, lossPct: result.lossPct, costPerKg: result.costPerKg,
        extraCostFactory: form.extraCostFactory, usages, status: "closed",
        closedBy: user!.id, closedAt: todayISO(), note: form.note,
        outputs, transfersOut, factoryStockOpen, factoryStockEnd,
        materialOpening, materialClosing, materialIntake: [],
        recipeSnapshot: state.recipes.map(r => ({ ...r })),
        standardOutputPerBatch2, materialCostPerBatch2,
        lossPerBatch: result.lossPerBatch, materialStockValueEnd: Math.round(materialStockValueEnd),
      };
      return { ...s, productionDays: [day, ...s.productionDays], materials, factoryInventory, transfers };
    });
    setOpen(false); setShowPreview(false); setForm(blank());
  };

  const prodName = (id: string) => state.products.find(p => p.id === id)?.name || "—";
  const openMat = (day: ProductionDay, matId: string, phase: "open" | "close") => {
    const arr = phase === "open" ? day.materialOpening : day.materialClosing;
    const v = arr?.find(x => x.materialId === matId);
    return v ? formatNumber(v.qty, 2) : "—";
  };
  const pqty = (arr: ProductQty[] | undefined, pid: string) => arr?.find(x => x.productId === pid)?.qtyKg || 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sổ Xưởng"
        subtitle="Tồn đầu/cuối NVL • Ra thành phẩm tách loại • Tổng Kho Xưởng nối ngày (theo sổ Kiểm Kho)"
        actions={canManage && <button className="btn-primary" onClick={() => { setForm(blank()); setShowPreview(false); setOpen(true); }}><Plus className="h-4 w-4" /> Tạo ngày sản xuất</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Số mẻ còn làm được" value={remaining} hint="Với tồn NVL hiện tại" tone={remaining < 3 ? "bad" : "default"} />
        <StatCard label="Tổng Kho Xưởng" value={formatKg(factoryStock)} />
        <StatCard label="Ngày SX đã chốt" value={state.productionDays.filter(d => d.status === "closed").length} />
        <StatCard label="Tổng mẻ tháng" value={state.productionDays.filter(d => d.productionDate.startsWith(todayISO().slice(0, 7))).reduce((s, d) => s + d.batch1Count + d.batch2Count, 0)} />
      </div>

      {/* Thành phẩm theo loại (TT / TTC / Ngắn / Vụn) */}
      <div className="card overflow-x-auto">
        <div className="px-3 py-2 border-b font-semibold text-sm">Thành phẩm theo loại — Ra / Về CL / Tồn Kho Xưởng</div>
        <table className="table-base">
          <thead>
            <tr>
              <th rowSpan={2} className="align-bottom">Ngày</th>
              <th rowSpan={2} className="text-right align-bottom">Mẻ 1</th>
              <th rowSpan={2} className="text-right align-bottom">Mẻ 2</th>
              {outputProducts.map(p => <th key={p.id} colSpan={3} className="text-center border-l">{p.name}</th>)}
              <th rowSpan={2} className="text-right align-bottom border-l">Tổng kho xưởng</th>
            </tr>
            <tr>
              {outputProducts.map(p => (
                <React.Fragment key={p.id}>
                  <th className="text-right border-l text-xs">Ra</th>
                  <th className="text-right text-xs">Về CL</th>
                  <th className="text-right text-xs">Tồn</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.productionDays.map(d => (
              <tr key={d.id}>
                <td className="whitespace-nowrap">{formatDate(d.productionDate)}<div className="text-xs text-gray-400">{d.productionCode}</div></td>
                <td className="text-right">{d.batch1Count}</td>
                <td className="text-right">{d.batch2Count}</td>
                {outputProducts.map(p => (
                  <React.Fragment key={p.id}>
                    <td className="text-right border-l">{formatNumber(pqty(d.outputs, p.id), 1)}</td>
                    <td className="text-right text-gray-500">{formatNumber(pqty(d.transfersOut, p.id), 1)}</td>
                    <td className="text-right font-medium">{formatNumber(pqty(d.factoryStockEnd, p.id), 1)}</td>
                  </React.Fragment>
                ))}
                <td className="text-right font-semibold border-l">{formatKg(d.factoryStockKgEnd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {state.productionDays.length === 0 && <EmptyState />}
      </div>

      {/* Sổ NVL — tồn đầu / cuối + hao hụt / giá thành */}
      <div className="card overflow-x-auto">
        <div className="px-3 py-2 border-b font-semibold text-sm">Sổ NVL — tồn đầu / cuối theo định mức</div>
        <table className="table-base text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-gray-50 z-10">Ngày</th>
              <th>Ca</th>
              {activeMaterials.map(m => <th key={m.id} className="text-right whitespace-nowrap">{m.name}</th>)}
              <th className="text-right whitespace-nowrap">Hao hụt/mẻ</th>
              {showFin && <th className="text-right whitespace-nowrap">Giá thành/kg</th>}
            </tr>
          </thead>
          <tbody>
            {state.productionDays.map(d => (
              <React.Fragment key={d.id}>
                <tr>
                  <td rowSpan={2} className="sticky left-0 bg-white z-10 align-top whitespace-nowrap font-medium">{formatDate(d.productionDate)}</td>
                  <td className="text-gray-500">đầu</td>
                  {activeMaterials.map(m => <td key={m.id} className="text-right">{openMat(d, m.id, "open")}</td>)}
                  <td rowSpan={2} className="text-right align-middle font-medium">{d.lossPerBatch != null ? formatNumber(d.lossPerBatch, 2) : "—"}</td>
                  {showFin && <td rowSpan={2} className="text-right align-middle font-medium text-emerald-700">{formatMoney(d.costPerKg)}</td>}
                </tr>
                <tr className="border-b-2 border-gray-100">
                  <td className="text-gray-500">cuối</td>
                  {activeMaterials.map(m => <td key={m.id} className="text-right text-gray-600">{openMat(d, m.id, "close")}</td>)}
                </tr>
              </React.Fragment>
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
          </div>

          {/* Thành phẩm theo loại */}
          <div>
            <div className="text-sm font-semibold mb-2 text-gray-700">Ra thành phẩm theo loại (kg)</div>
            <div className="overflow-x-auto border border-gray-200 rounded-md">
              <table className="table-base">
                <thead><tr><th>Loại</th><th className="text-right">Kho Xưởng (đầu)</th><th className="w-32">Ra thành phẩm</th><th className="w-32">Về Cát Linh</th><th className="text-right">Tồn cuối</th></tr></thead>
                <tbody>
                  {outputProducts.map(p => {
                    const openQ = invQty(state.factoryInventory, p.id);
                    const out = form.outputs[p.id] || 0;
                    const away = form.transfersOut[p.id] || 0;
                    return (
                      <tr key={p.id}>
                        <td className="font-medium">{p.name}</td>
                        <td className="text-right text-gray-500">{formatKg(openQ)}</td>
                        <td><input type="number" step="0.1" className="input" value={form.outputs[p.id] || ""} onChange={e => setForm(f => ({ ...f, outputs: { ...f.outputs, [p.id]: Number(e.target.value) } }))} /></td>
                        <td><input type="number" step="0.1" className="input" value={form.transfersOut[p.id] || ""} onChange={e => setForm(f => ({ ...f, transfersOut: { ...f.transfersOut, [p.id]: Number(e.target.value) } }))} /></td>
                        <td className={`text-right font-medium ${openQ + out - away < 0 ? "text-red-600" : ""}`}>{formatKg(openQ + out - away)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td>Tổng</td><td></td>
                    <td className="text-right pr-3">{formatKg(outputTotal)}</td>
                    <td className="text-right pr-3">{formatKg(transferTotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="text-xs text-gray-500 mt-1">Về Cát Linh &gt; 0 sẽ tạo phiếu chuyển kho (chờ Kho Cát Linh xác nhận nhận hàng).</div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Chi phí lặt vặt xưởng (đ)</label><input type="number" className="input" value={form.extraCostFactory} onChange={e => setForm(f => ({ ...f, extraCostFactory: Number(e.target.value) }))} /></div>
            <div><label className="label">Ghi chú</label><input className="input" value={form.note || ""} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></div>
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
            <div><div className="text-gray-500 text-xs">Sản lượng chuẩn</div><div className="font-semibold">{formatKg(result.expectedOutput)}</div></div>
            <div><div className="text-gray-500 text-xs">Hao hụt</div><div className="font-semibold">{formatKg(result.lossKg)} ({formatPct(result.lossPct)}) · {formatNumber(result.lossPerBatch, 2)}/mẻ</div></div>
            {showFin && <div><div className="text-gray-500 text-xs">Giá thành/kg</div><div className="font-semibold text-emerald-700">{formatMoney(result.costPerKg)}</div></div>}
          </div>
        </div>
      </Modal>
    </div>
  );
}
