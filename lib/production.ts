import type { Material, ProductionRecipe, MaterialUsage, ProductionDay } from "@/types";

// Trừ lùi NVL theo định mức (Rule 1): used = b1*rate1 + b2*rate2
export function computeUsages(
  batch1Count: number,
  batch2Count: number,
  recipes: ProductionRecipe[],
  materials: Material[],
): MaterialUsage[] {
  return recipes
    .map(r => {
      const usedQty = +(batch1Count * r.batch1Rate + batch2Count * r.batch2Rate).toFixed(3);
      const mat = materials.find(m => m.id === r.materialId);
      const unitPrice = mat?.unitPrice ?? 0;
      return { materialId: r.materialId, usedQty, unitPriceAtUse: unitPrice, totalCost: Math.round(usedQty * unitPrice) };
    })
    .filter(u => u.usedQty > 0);
}

export interface BatchResult {
  totalMaterialCost: number; // Σ định mức × đơn giá (tham chiếu)
  expectedOutput: number;    // = sản lượng chuẩn/mẻ 2 × số mẻ 2
  lossKg: number;
  lossPct: number;
  lossPerBatch: number;      // hao hụt / mẻ (theo sổ)
  costPerKg: number;         // giá thành/kg = (mẻ2 × chi phí NVL/mẻ2) / output
}

// Kết quả mẻ theo công thức sổ Xưởng — dùng 2 hằng số cấu hình, KHÔNG hard-code.
export function computeBatchResult(
  usages: MaterialUsage[],
  outputKg: number,
  batch2Count: number,
  standardOutputPerBatch2: number,
  materialCostPerBatch2: number,
): BatchResult {
  const totalMaterialCost = usages.reduce((s, u) => s + u.totalCost, 0);
  const expectedOutput = +(standardOutputPerBatch2 * batch2Count).toFixed(2);
  const lossKg = +(expectedOutput - outputKg).toFixed(2);
  const lossPct = expectedOutput > 0 ? +((lossKg / expectedOutput) * 100).toFixed(2) : 0;
  const lossPerBatch = batch2Count > 0 ? +(lossKg / batch2Count).toFixed(3) : 0;
  const costPerKg = outputKg > 0 ? Math.round((batch2Count * materialCostPerBatch2) / outputKg) : 0;
  return { totalMaterialCost, expectedOutput, lossKg, lossPct, lossPerBatch, costPerKg };
}

// Số mẻ còn có thể làm với tồn NVL hiện tại: MIN(qty / (rate1+rate2))
export function batchesRemaining(materials: Material[], recipes: ProductionRecipe[]): number {
  let min = Infinity;
  for (const r of recipes) {
    const rate = r.batch1Rate + r.batch2Rate;
    if (rate <= 0) continue;
    const mat = materials.find(m => m.id === r.materialId);
    if (!mat) continue;
    min = Math.min(min, mat.qty / rate);
  }
  return min === Infinity ? 0 : Math.floor(min);
}

// Số ngày NVL còn dùng được = mẻ còn lại của NVL đó / mẻ dự kiến mỗi ngày (người dùng nhập)
export function materialDaysLeft(material: Material, recipe: ProductionRecipe | undefined, batchesPerDay: number): number {
  if (!recipe) return 999;
  const rate = recipe.batch1Rate + recipe.batch2Rate;
  if (rate <= 0 || batchesPerDay <= 0) return 999;
  const batches = material.qty / rate;
  return Math.floor(batches / batchesPerDay);
}

export function avgBatchesPerDay(days: ProductionDay[]): number {
  const closed = days.filter(d => d.status === "closed");
  if (closed.length === 0) return 10; // mặc định giả định 10 mẻ/ngày
  const total = closed.reduce((s, d) => s + d.batch1Count + d.batch2Count, 0);
  return total / closed.length;
}

// Vốn NVL tồn xưởng = Σ tồn × đơn giá
export function materialStockValue(materials: Material[]): number {
  return materials.reduce((s, m) => s + m.qty * m.unitPrice, 0);
}
