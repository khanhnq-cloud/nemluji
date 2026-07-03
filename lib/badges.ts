import type { State } from "./store";
import { avgBatchesPerDay, materialDaysLeft } from "./production";

// Đếm số liệu cho badge sidebar: phiếu thu chờ + NVL sắp hết
export function calcDaysLeftBadges(state: State) {
  const pendingReceipts = state.receipts.filter(
    r => r.status === "pending" || r.status === "waiting_admin"
  ).length;

  const avg = avgBatchesPerDay(state.productionDays);
  const lowMaterials = state.materials.filter(m => {
    const recipe = state.recipes.find(r => r.materialId === m.id);
    return materialDaysLeft(m, recipe, avg) < (m.warningDays || 3);
  }).length;

  return { pendingReceipts, lowMaterials };
}
