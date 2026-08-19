import type { State } from "./store";
import { materialDaysLeft } from "./production";

// Đếm số liệu cho badge sidebar: phiếu thu chờ + NVL sắp hết
export function calcDaysLeftBadges(state: State) {
  const pendingReceipts = state.receipts.filter(
    r => r.status === "pending" || r.status === "waiting_admin"
  ).length;

  const batchesPerDay = state.settings.plannedBatchesPerDay || 8;
  const lowMaterials = state.materials.filter(m => {
    if (!m.isActive) return false;
    const recipe = state.recipes.find(r => r.materialId === m.id);
    return materialDaysLeft(m, recipe, batchesPerDay) < (m.warningDays || 3);
  }).length;

  return { pendingReceipts, lowMaterials };
}
