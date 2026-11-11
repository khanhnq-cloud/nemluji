import type { State } from "./store";
import type { MckLog, StockTransfer, Expense, DestructionLog, Profile } from "@/types";
import { adjustInventory, invQty } from "./inventory";
import { nextSequentialCode, newId, todayISO } from "./utils";

// Số lượng MCK còn phải xử lý
export function mckRemaining(m: MckLog): number {
  return +(m.qtyKg - (m.resolvedQty || 0)).toFixed(2);
}

export const mckSourceOf = (m: Pick<MckLog, "source">) => m.source || "mck";

// Ghi nhận hàng chờ xử lý tại Kho Cát Linh, tạo log "pending":
// - mck: hàng trong kho mất chân không → trừ tồn bán được
// - return: hàng khách đổi về → không trừ tồn (đã trừ lúc bán), chờ test + mang sang xưởng hút lại
export function createMck(
  state: State,
  input: { logDate: string; productId: string; qtyKg: number; note?: string; source?: "mck" | "return" },
  actor: Profile,
): State {
  const source = input.source || "mck";
  const avail = invQty(state.clInventory, input.productId);
  if (input.qtyKg <= 0 || (source === "mck" && input.qtyKg > avail)) return state;
  const log: MckLog = {
    id: newId(),
    code: nextSequentialCode(source === "return" ? "DV" : "MCK", state.mckLogs.filter(m => mckSourceOf(m) === source).map(m => m.code)),
    logDate: input.logDate,
    productId: input.productId,
    qtyKg: +input.qtyKg.toFixed(2),
    status: "pending",
    resolvedQty: 0,
    source,
    note: input.note,
    createdBy: actor.id,
  };
  return {
    ...state,
    mckLogs: [log, ...state.mckLogs],
    clInventory: source === "mck" ? adjustInventory(state.clInventory, input.productId, -input.qtyKg) : state.clInventory,
  };
}

// Lọc hàng → Tiêu huỷ thẳng từ tồn Kho Cát Linh: trừ tồn + sinh phiếu chi (fix_cost × SL)
export function destroyFromCl(
  state: State,
  input: { logDate: string; productId: string; qtyKg: number; reason?: string },
  actor: Profile,
): State {
  const avail = invQty(state.clInventory, input.productId);
  const qty = +Number(input.qtyKg).toFixed(2);
  if (qty <= 0 || qty > avail) return state;
  const prod = state.products.find(p => p.id === input.productId);
  const unitCost = prod?.fixCost || 0;
  const total = Math.round(qty * unitCost);
  const expenseId = newId();
  const logId = newId();
  const reason = input.reason?.trim() || "";
  const expense: Expense = {
    id: expenseId, code: nextSequentialCode("PC", state.expenses.map(e => e.code)), date: input.logDate, type: "destruction",
    amount: total, refId: logId,
    note: `Tiêu huỷ ${qty}kg ${prod?.name} (Lọc hàng — Kho Cát Linh)${reason ? " — " + reason : ""}`,
    createdBy: actor.id, createdAt: new Date().toISOString(),
  };
  const dlog: DestructionLog = {
    id: logId, logDate: input.logDate, productId: input.productId, warehouse: "cl",
    qtyKg: qty, unitCost, totalLoss: total, reason: reason || "Lọc hàng — tiêu huỷ", expenseId, createdBy: actor.id,
  };
  return {
    ...state,
    expenses: [expense, ...state.expenses],
    destructionLogs: [dlog, ...state.destructionLogs],
    clInventory: adjustInventory(state.clInventory, input.productId, -qty),
  };
}

function applyResolve(state: State, mckId: string, qty: number, patch: Partial<MckLog>, finalStatus: MckLog["status"]): MckLog[] {
  return state.mckLogs.map(m => {
    if (m.id !== mckId) return m;
    const resolved = +((m.resolvedQty || 0) + qty).toFixed(2);
    const done = resolved >= m.qtyKg - 0.001;
    return { ...m, ...patch, resolvedQty: resolved, status: done ? finalStatus : m.status };
  });
}

// Hút lại được ngay tại Cát Linh → trả về tồn bán được
export function revacuumCl(state: State, mckId: string, qty: number): State {
  const m = state.mckLogs.find(x => x.id === mckId);
  if (!m || qty <= 0 || qty > mckRemaining(m)) return state;
  return {
    ...state,
    mckLogs: applyResolve(state, mckId, qty, {}, "revacuumed_cl"),
    clInventory: adjustInventory(state.clInventory, m.productId, qty),
  };
}

// Tiêu huỷ tại Cát Linh → sinh phiếu chi = fix_cost × SL (tồn đã trừ khi tạo MCK)
export function destroyMck(state: State, mckId: string, qty: number, reason: string, actor: Profile): State {
  const m = state.mckLogs.find(x => x.id === mckId);
  if (!m || qty <= 0 || qty > mckRemaining(m)) return state;
  const prod = state.products.find(p => p.id === m.productId);
  const unitCost = prod?.fixCost || 0;
  const total = Math.round(qty * unitCost);
  const expenseId = newId();
  const logId = newId();
  const expense: Expense = {
    id: expenseId, code: nextSequentialCode("PC", state.expenses.map(e => e.code)), date: todayISO(), type: "destruction",
    amount: total, refId: logId,
    note: `Tiêu huỷ ${mckSourceOf(m) === "return" ? "hàng đổi về" : "MCK"} ${qty}kg ${prod?.name} (Kho Cát Linh)${reason ? " — " + reason : ""}`,
    createdBy: actor.id, createdAt: new Date().toISOString(),
  };
  const dlog: DestructionLog = {
    id: logId, logDate: todayISO(), productId: m.productId, warehouse: "cl",
    qtyKg: qty, unitCost, totalLoss: total, reason: reason || "MCK không hút lại được", expenseId, createdBy: actor.id,
  };
  return {
    ...state,
    expenses: [expense, ...state.expenses],
    destructionLogs: [dlog, ...state.destructionLogs],
    mckLogs: applyResolve(state, mckId, qty, { destructionId: logId, expenseId }, "destroyed"),
  };
}

// Recover: tạo phiếu chuyển CL → Xưởng + phí ship (sinh phiếu chi)
export function recoverMckToFactory(state: State, mckId: string, qty: number, shipFee: number, actor: Profile): State {
  const m = state.mckLogs.find(x => x.id === mckId);
  if (!m || qty <= 0 || qty > mckRemaining(m)) return state;
  const prod = state.products.find(p => p.id === m.productId);
  const transferId = newId();
  let expenses = state.expenses;
  let expenseId: string | undefined;
  if (shipFee > 0) {
    expenseId = newId();
    const expense: Expense = {
      id: expenseId, code: nextSequentialCode("PC", expenses.map(e => e.code)), date: todayISO(), type: "mck_ship",
      amount: Math.round(shipFee), refId: transferId,
      note: `Ship ${mckSourceOf(m) === "return" ? "hàng đổi về" : "MCK"} ${qty}kg ${prod?.name} về xưởng để hút lại`,
      createdBy: actor.id, createdAt: new Date().toISOString(),
    };
    expenses = [expense, ...expenses];
  }
  const transfer: StockTransfer = {
    id: transferId, transferCode: nextSequentialCode("TR", state.transfers.map(t => t.transferCode)),
    transferDate: todayISO(), productId: m.productId, qtyKg: qty, status: "pending",
    direction: "cl_to_factory", shipFee: shipFee > 0 ? Math.round(shipFee) : undefined, expenseId, mckLogId: mckId,
    note: mckSourceOf(m) === "return" ? "Hàng đổi về chuyển về xưởng để hút lại" : "MCK chuyển về xưởng để recover",
  };
  return {
    ...state,
    expenses,
    transfers: [transfer, ...state.transfers],
    mckLogs: applyResolve(state, mckId, qty, { transferId, expenseId }, "sent_to_factory"),
  };
}
