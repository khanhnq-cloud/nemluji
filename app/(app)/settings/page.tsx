"use client";
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import { useStore } from "@/lib/store";
import { formatMoney, newId } from "@/lib/utils";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Product, Material, ProductionRecipe } from "@/types";

type ProdForm = { id?: string; sku: string; name: string; unit: string; defaultPrice: number; fixCost: number; isFactoryOutput: boolean };
type MatForm = { name: string; unit: string; unitPrice: number; warningDays: number; batch1Rate: number; batch2Rate: number };

const blankProd = (): ProdForm => ({ sku: "", name: "", unit: "kg", defaultPrice: 0, fixCost: 0, isFactoryOutput: true });
const blankMat = (): MatForm => ({ name: "", unit: "kg", unitPrice: 0, warningDays: 3, batch1Rate: 0, batch2Rate: 0 });

export default function SettingsPage() {
  const { state, update } = useStore();
  const [tab, setTab] = useState<"products" | "recipe" | "config">("products");
  const [prodForm, setProdForm] = useState<ProdForm | null>(null);
  const [matForm, setMatForm] = useState<MatForm | null>(null);

  // --- Products ---
  const saveProd = () => {
    if (!prodForm) return;
    if (!prodForm.name.trim()) { alert("Nhập tên sản phẩm"); return; }
    if (prodForm.id) {
      update(s => ({ ...s, products: s.products.map(p => p.id === prodForm.id ? { ...p, ...prodForm } : p) }));
    } else {
      const p: Product = {
        id: newId(),
        sku: prodForm.sku.trim() || prodForm.name.toUpperCase().slice(0, 6),
        name: prodForm.name.trim(),
        unit: prodForm.unit || "kg",
        defaultPrice: prodForm.defaultPrice,
        fixCost: prodForm.fixCost,
        isActive: true,
        isFactoryOutput: prodForm.isFactoryOutput,
      };
      update(s => ({ ...s, products: [...s.products, p] }));
    }
    setProdForm(null);
  };

  const deleteProd = (id: string) => {
    const usedInOrders = state.orders.some(o => o.items.some(i => i.productId === id));
    const usedInTransfers = state.transfers.some(t => t.productId === id);
    const usedInStock = [...state.factoryInventory, ...state.clInventory].some(i => i.productId === id && i.qtyKg > 0);
    const usedInRecovery = state.recoveryLogs.some(r => r.productId === id);
    const usedInDestruction = state.destructionLogs.some(d => d.productId === id);
    const isReferenced = usedInOrders || usedInTransfers || usedInStock || usedInRecovery || usedInDestruction;
    if (isReferenced) {
      if (!confirm("Sản phẩm này đang được sử dụng trong đơn hàng / tồn kho. Chuyển sang trạng thái \"Ngưng\" thay vì xóa?")) return;
      update(s => ({ ...s, products: s.products.map(p => p.id === id ? { ...p, isActive: false } : p) }));
    } else {
      if (!confirm("Xóa hẳn sản phẩm này? Thao tác không thể hoàn tác.")) return;
      update(s => ({ ...s, products: s.products.filter(p => p.id !== id) }));
    }
  };

  const toggleProdActive = (id: string, current: boolean) =>
    update(s => ({ ...s, products: s.products.map(p => p.id === id ? { ...p, isActive: !current } : p) }));

  // --- Materials / Recipe ---
  const setRecipe = (materialId: string, field: "batch1Rate" | "batch2Rate", value: number) =>
    update(s => ({ ...s, recipes: s.recipes.map(r => r.materialId === materialId ? { ...r, [field]: value } : r) }));

  const setMatPrice = (id: string, value: number) =>
    update(s => ({ ...s, materials: s.materials.map(m => m.id === id ? { ...m, unitPrice: value } : m) }));

  const saveMat = () => {
    if (!matForm) return;
    if (!matForm.name.trim()) { alert("Nhập tên NVL"); return; }
    const id = newId();
    const mat: Material = {
      id, name: matForm.name.trim(), unit: matForm.unit || "kg",
      unitPrice: matForm.unitPrice, warningDays: matForm.warningDays, qty: 0, isActive: true,
    };
    const rec: ProductionRecipe = { materialId: id, batch1Rate: matForm.batch1Rate, batch2Rate: matForm.batch2Rate };
    update(s => ({ ...s, materials: [...s.materials, mat], recipes: [...s.recipes, rec] }));
    setMatForm(null);
  };

  const deleteMat = (matId: string) => {
    const usedInProd = state.productionDays.some(d => d.usages.some(u => u.materialId === matId));
    if (usedInProd) {
      alert("NVL này đã được dùng trong dữ liệu sản xuất. Không thể xóa để giữ toàn vẹn dữ liệu.");
      return;
    }
    if (!confirm("Xóa nguyên liệu và định mức này? Thao tác không thể hoàn tác.")) return;
    update(s => ({
      ...s,
      materials: s.materials.filter(m => m.id !== matId),
      recipes: s.recipes.filter(r => r.materialId !== matId),
    }));
  };

  const setSetting = (patch: Partial<typeof state.settings>) =>
    update(s => ({ ...s, settings: { ...s.settings, ...patch } }));

  return (
    <div className="space-y-4">
      <PageHeader title="Cài đặt" subtitle="Sản phẩm & giá • Định mức nguyên liệu • Cấu hình tài chính" />

      <div className="flex gap-2 border-b border-gray-200">
        {[{ k: "products", label: "Sản phẩm & giá" }, { k: "recipe", label: "Định mức NVL" }, { k: "config", label: "Cấu hình" }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.k ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "products" && (
        <div className="card overflow-x-auto">
          <div className="p-3 flex justify-end border-b">
            <button className="btn-primary btn-sm" onClick={() => setProdForm(blankProd())}>
              <Plus className="h-3.5 w-3.5" /> Thêm sản phẩm
            </button>
          </div>
          <table className="table-base">
            <thead>
              <tr>
                <th>SKU</th><th>Tên</th><th>Đơn vị</th>
                <th className="w-36">Giá bán</th><th className="w-36">Giá vốn (fix_cost)</th>
                <th>Thành phẩm xưởng</th><th>Trạng thái</th><th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {state.products.map(p => (
                <tr key={p.id} className={!p.isActive ? "opacity-50" : ""}>
                  <td className="font-medium">{p.sku}</td>
                  <td>{p.name}</td>
                  <td>{p.unit}</td>
                  <td>
                    <input type="number" className="input" value={p.defaultPrice}
                      onChange={e => update(s => ({ ...s, products: s.products.map(x => x.id === p.id ? { ...x, defaultPrice: Number(e.target.value) } : x) }))} />
                  </td>
                  <td>
                    <input type="number" className="input" value={p.fixCost}
                      onChange={e => update(s => ({ ...s, products: s.products.map(x => x.id === p.id ? { ...x, fixCost: Number(e.target.value) } : x) }))} />
                  </td>
                  <td>
                    <button onClick={() => update(s => ({ ...s, products: s.products.map(x => x.id === p.id ? { ...x, isFactoryOutput: !x.isFactoryOutput } : x) }))}
                      className={p.isFactoryOutput ? "badge-blue cursor-pointer" : "badge-gray cursor-pointer"}
                      title="Bật để hiện thành cột trong Sổ Xưởng">
                      {p.isFactoryOutput ? "Có (vào Sổ Xưởng)" : "Không"}
                    </button>
                  </td>
                  <td>
                    <button onClick={() => toggleProdActive(p.id, p.isActive)}
                      className={p.isActive ? "badge-green cursor-pointer" : "badge-gray cursor-pointer"}>
                      {p.isActive ? "Đang dùng" : "Ngưng"}
                    </button>
                  </td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                        title="Sửa"
                        onClick={() => setProdForm({ id: p.id, sku: p.sku, name: p.name, unit: p.unit, defaultPrice: p.defaultPrice, fixCost: p.fixCost, isFactoryOutput: !!p.isFactoryOutput })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-red-50 text-red-500"
                        title="Xóa / Ngưng"
                        onClick={() => deleteProd(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "recipe" && (
        <div className="card overflow-x-auto">
          <div className="p-3 flex justify-end border-b">
            <button className="btn-primary btn-sm" onClick={() => setMatForm(blankMat())}>
              <Plus className="h-3.5 w-3.5" /> Thêm NVL
            </button>
          </div>
          <div className="px-3 py-2 border-b text-xs text-gray-500">Định mức tiêu thụ NVL cho mỗi mẻ (kg/mẻ). Trừ lùi tự động khi chốt ngày sản xuất.</div>
          <table className="table-base">
            <thead>
              <tr>
                <th>Nguyên liệu</th><th>Đơn vị</th>
                <th className="w-32">ĐM mẻ 1</th><th className="w-32">ĐM mẻ 2</th>
                <th className="w-36">Giá/đv</th><th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {state.materials.map(m => {
                const r = state.recipes.find(x => x.materialId === m.id);
                return (
                  <tr key={m.id}>
                    <td className="font-medium">{m.name}</td>
                    <td>{m.unit}</td>
                    <td>
                      <input type="number" step="0.001" className="input" value={r?.batch1Rate ?? 0}
                        onChange={e => setRecipe(m.id, "batch1Rate", Number(e.target.value))} />
                    </td>
                    <td>
                      <input type="number" step="0.001" className="input" value={r?.batch2Rate ?? 0}
                        onChange={e => setRecipe(m.id, "batch2Rate", Number(e.target.value))} />
                    </td>
                    <td>
                      <input type="number" className="input" value={m.unitPrice}
                        onChange={e => setMatPrice(m.id, Number(e.target.value))} />
                    </td>
                    <td>
                      <button
                        className="p-1.5 rounded hover:bg-red-50 text-red-500"
                        title="Xóa NVL & định mức"
                        onClick={() => deleteMat(m.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "config" && (
        <div className="space-y-4">
          <div className="card p-4 max-w-2xl grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 text-sm font-semibold text-gray-700">Bán hàng & hoa hồng</div>
            <Field label="% hoa hồng đơn hàng mặc định" value={state.settings.defaultCommissionPct} onChange={v => setSetting({ defaultCommissionPct: v })} suffix="%" />
            <Field label="% hoa hồng công nợ mặc định" value={state.settings.defaultDebtCommissionPct} onChange={v => setSetting({ defaultDebtCommissionPct: v })} suffix="%" />
            <Field label="% CK trả sớm mặc định" value={state.settings.defaultEarlyPayPct} onChange={v => setSetting({ defaultEarlyPayPct: v })} suffix="%" />
            <p className="sm:col-span-2 text-xs text-gray-500">
              % hoa hồng ở đây là mặc định khi tạo nhân viên mới; mỗi nhân viên có thể đặt riêng ở trang Người dùng và sửa được trên từng dòng bảng lương.
            </p>
          </div>

          <div className="card p-4 max-w-2xl grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 text-sm font-semibold text-gray-700">Cấu hình Xưởng — giá thành & dự báo</div>
            <Field label="Sản lượng chuẩn / mẻ 2 (kg)" value={state.settings.standardOutputPerBatch2} onChange={v => setSetting({ standardOutputPerBatch2: v })} />
            <Field label="Chi phí NVL / mẻ 2 (đ)" value={state.settings.materialCostPerBatch2} onChange={v => setSetting({ materialCostPerBatch2: v })} />
            <Field label="Số mẻ dự kiến / ngày (dự báo NVL)" value={state.settings.plannedBatchesPerDay} onChange={v => setSetting({ plannedBatchesPerDay: v })} />
            <Field label="Cảnh báo NVL (ngày)" value={state.settings.nvlWarningDays} onChange={v => setSetting({ nvlWarningDays: v })} />
            <p className="sm:col-span-2 text-xs text-gray-500">
              Hao hụt/mẻ = (sản lượng chuẩn × mẻ 2 − Ra thành phẩm) / mẻ 2. Giá thành/kg = (mẻ 2 × chi phí NVL/mẻ 2) / Ra thành phẩm.
              Ngày sản xuất đã chốt giữ nguyên hằng số tại thời điểm chốt, sửa ở đây chỉ áp dụng cho ngày mới.
            </p>
          </div>

          <div className="card p-4 max-w-2xl grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 text-sm font-semibold text-gray-700">Lương xưởng</div>
            <Field label="Mẻ thường/ngày (ngưỡng)" value={state.settings.factoryBatchThreshold} onChange={v => setSetting({ factoryBatchThreshold: v })} />
            <Field label="Chi phí mẻ làm thêm (đ/mẻ)" value={state.settings.factoryExtraBatchBonus} onChange={v => setSetting({ factoryExtraBatchBonus: v })} />
            <Field label="Chi phí ngày tăng ca (đ/ngày)" value={state.settings.factoryOvertimeDayBonus} onChange={v => setSetting({ factoryOvertimeDayBonus: v })} />
            <p className="sm:col-span-2 text-xs text-gray-500">Chi phí mẻ / tăng ca chỉ áp dụng cho nhóm xưởng.</p>
          </div>
        </div>
      )}

      {/* Modal: Thêm / Sửa sản phẩm */}
      <Modal
        open={!!prodForm}
        onClose={() => setProdForm(null)}
        title={prodForm?.id ? "Sửa sản phẩm" : "Thêm sản phẩm"}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setProdForm(null)}>Huỷ</button>
            <button className="btn-primary" onClick={saveProd}>Lưu</button>
          </>
        }
      >
        {prodForm && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">SKU</label>
              <input className="input" placeholder="VD: TT, TTC, VUN" value={prodForm.sku}
                onChange={e => setProdForm(f => f ? { ...f, sku: e.target.value } : f)} />
            </div>
            <div>
              <label className="label">Tên sản phẩm *</label>
              <input className="input" value={prodForm.name}
                onChange={e => setProdForm(f => f ? { ...f, name: e.target.value } : f)} />
            </div>
            <div>
              <label className="label">Đơn vị</label>
              <input className="input" placeholder="kg / túi" value={prodForm.unit}
                onChange={e => setProdForm(f => f ? { ...f, unit: e.target.value } : f)} />
            </div>
            <div>
              <label className="label">Giá bán (đ)</label>
              <input type="number" className="input" value={prodForm.defaultPrice}
                onChange={e => setProdForm(f => f ? { ...f, defaultPrice: Number(e.target.value) } : f)} />
            </div>
            <div>
              <label className="label">Giá vốn — fix_cost (đ)</label>
              <input type="number" className="input" value={prodForm.fixCost}
                onChange={e => setProdForm(f => f ? { ...f, fixCost: Number(e.target.value) } : f)} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={prodForm.isFactoryOutput}
                  onChange={e => setProdForm(f => f ? { ...f, isFactoryOutput: e.target.checked } : f)} />
                Là thành phẩm xưởng (hiện trong Sổ Xưởng)
              </label>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Thêm NVL & định mức */}
      <Modal
        open={!!matForm}
        onClose={() => setMatForm(null)}
        title="Thêm nguyên liệu & định mức"
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setMatForm(null)}>Huỷ</button>
            <button className="btn-primary" onClick={saveMat}>Lưu</button>
          </>
        }
      >
        {matForm && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Tên NVL *</label>
              <input className="input" value={matForm.name}
                onChange={e => setMatForm(f => f ? { ...f, name: e.target.value } : f)} />
            </div>
            <div>
              <label className="label">Đơn vị</label>
              <input className="input" placeholder="kg / lít / gói" value={matForm.unit}
                onChange={e => setMatForm(f => f ? { ...f, unit: e.target.value } : f)} />
            </div>
            <div>
              <label className="label">Giá/đv (đ)</label>
              <input type="number" className="input" value={matForm.unitPrice}
                onChange={e => setMatForm(f => f ? { ...f, unitPrice: Number(e.target.value) } : f)} />
            </div>
            <div>
              <label className="label">Cảnh báo tồn (ngày)</label>
              <input type="number" className="input" value={matForm.warningDays}
                onChange={e => setMatForm(f => f ? { ...f, warningDays: Number(e.target.value) } : f)} />
            </div>
            <div>
              <label className="label">ĐM mẻ 1 (kg/mẻ)</label>
              <input type="number" step="0.001" className="input" value={matForm.batch1Rate}
                onChange={e => setMatForm(f => f ? { ...f, batch1Rate: Number(e.target.value) } : f)} />
            </div>
            <div>
              <label className="label">ĐM mẻ 2 (kg/mẻ)</label>
              <input type="number" step="0.001" className="input" value={matForm.batch2Rate}
                onChange={e => setMatForm(f => f ? { ...f, batch2Rate: Number(e.target.value) } : f)} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input type="number" className="input" value={value} onChange={e => onChange(Number(e.target.value))} />
        {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
      </div>
    </div>
  );
}
