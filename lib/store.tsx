"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type {
  Profile, Customer, CustomerBranch, Product, Order, Receipt,
  DebtStatement, Lead, Material, ProductionRecipe, ProductionDay,
  StockTransfer, ClInventory, Attendance, PayrollPeriod, RecoveryLog,
  DestructionLog, NewCustomerCredit, AppSettings, Expense, MckLog,
} from "@/types";
import {
  PROFILES, CUSTOMERS, CUSTOMER_BRANCHES, PRODUCTS, ORDERS, RECEIPTS,
  DEBT_STATEMENTS, LEADS, MATERIALS, RECIPES, PRODUCTION_DAYS,
  STOCK_TRANSFERS, CL_INVENTORY, FACTORY_INVENTORY, RECOVER_INVENTORY, RECOVERY_LOGS, DESTRUCTION_LOGS,
  MCK_LOGS, ATTENDANCE, PAYROLL_PERIODS, NEW_CUSTOMER_CREDITS, DEFAULT_SETTINGS, EXPENSES,
} from "./mock-data";
import { supabase, isSupabaseEnabled } from "./supabase";

export type State = {
  profiles: Profile[];
  customers: Customer[];
  branches: CustomerBranch[];
  products: Product[];
  orders: Order[];
  receipts: Receipt[];
  debtStatements: DebtStatement[];
  leads: Lead[];
  materials: Material[];
  recipes: ProductionRecipe[];
  productionDays: ProductionDay[];
  transfers: StockTransfer[];
  clInventory: ClInventory[];
  factoryInventory: ClInventory[];
  recoverInventory: ClInventory[];
  expenses: Expense[];
  recoveryLogs: RecoveryLog[];
  destructionLogs: DestructionLog[];
  mckLogs: MckLog[];
  attendance: Attendance[];
  payrollPeriods: PayrollPeriod[];
  newCustomerCredits: NewCustomerCredit[];
  settings: AppSettings;
};

type Updater = (s: State) => State;
type Ctx = {
  state: State;
  update: (fn: Updater) => void;
  ready: boolean;            // đã nạp xong dữ liệu dùng chung
  syncError: string | null;  // lỗi tải / ghi lên máy chủ gần nhất
};

const initial: State = {
  profiles: PROFILES,
  customers: CUSTOMERS,
  branches: CUSTOMER_BRANCHES,
  products: PRODUCTS,
  orders: ORDERS,
  receipts: RECEIPTS,
  debtStatements: DEBT_STATEMENTS,
  leads: LEADS,
  materials: MATERIALS,
  recipes: RECIPES,
  productionDays: PRODUCTION_DAYS,
  transfers: STOCK_TRANSFERS,
  clInventory: CL_INVENTORY,
  factoryInventory: FACTORY_INVENTORY,
  recoverInventory: RECOVER_INVENTORY,
  expenses: EXPENSES,
  recoveryLogs: RECOVERY_LOGS,
  destructionLogs: DESTRUCTION_LOGS,
  mckLogs: MCK_LOGS,
  attendance: ATTENDANCE,
  payrollPeriods: PAYROLL_PERIODS,
  newCustomerCredits: NEW_CUSTOMER_CREDITS,
  settings: DEFAULT_SETTINGS,
};

// ------------------------------------------------------------------
// Lưu trữ
// - Có Supabase: mỗi bản ghi là 1 dòng ở bảng app_records (collection, id) → data,
//   DÙNG CHUNG cho mọi tài khoản + đồng bộ realtime giữa các máy (supabase-app-records.sql).
// - Không có Supabase: localStorage như trước (chế độ demo 1 máy).
// ------------------------------------------------------------------

type ArrayKey = Exclude<keyof State, "settings">;
const ARRAY_KEYS = (Object.keys(initial) as (keyof State)[]).filter((k): k is ArrayKey => k !== "settings");
const keyOf = (c: ArrayKey, item: any): string =>
  String(c === "recipes" ? item.materialId
    : c === "clInventory" || c === "factoryInventory" || c === "recoverInventory" ? item.productId
    : item.id);

const TABLE = "app_records";
const META = "_meta";
type Row = { collection: string; id: string; data: any; updated_by?: string | null };

// localStorage cũ (trước khi dùng chung) — đẩy lên máy chủ 1 lần cho mỗi máy
const STORAGE_KEY = "nnnt_state_v9";
const MIGRATED_KEY = "nnnt_state_v9_migrated";

function withDefaults(saved: Partial<State>): State {
  return { ...initial, ...saved, settings: { ...initial.settings, ...(saved.settings || {}) } };
}

function stateToRows(s: State): Row[] {
  const rows: Row[] = [];
  for (const c of ARRAY_KEYS) for (const item of s[c] as any[]) rows.push({ collection: c, id: keyOf(c, item), data: item });
  rows.push({ collection: "settings", id: "settings", data: s.settings });
  return rows;
}

function rowsToState(rows: Row[]): State {
  const out: any = { settings: initial.settings };
  for (const c of ARRAY_KEYS) out[c] = [];
  for (const r of rows) {
    if (r.collection === "settings") out.settings = { ...initial.settings, ...r.data };
    else if ((ARRAY_KEYS as string[]).includes(r.collection)) out[r.collection].push(r.data);
  }
  return out as State;
}

// Thay đổi giữa 2 state — so theo tham chiếu từng bản ghi (mọi update đều immutable).
// Bản ghi nhận từ máy khác (remoteRefs / remoteDeleted) không ghi ngược lên máy chủ.
function diffStates(prev: State, next: State, remoteRefs: WeakSet<object>, remoteDeleted: Set<string>) {
  const ups: Row[] = [];
  const dels: { collection: string; id: string }[] = [];
  for (const c of ARRAY_KEYS) {
    if (prev[c] === next[c]) continue;
    const before = new Map<string, any>();
    for (const item of prev[c] as any[]) before.set(keyOf(c, item), item);
    for (const item of next[c] as any[]) {
      const k = keyOf(c, item);
      if (before.get(k) !== item && !remoteRefs.has(item)) ups.push({ collection: c, id: k, data: item });
      before.delete(k);
    }
    for (const k of Array.from(before.keys())) {
      if (remoteDeleted.has(`${c}/${k}`)) remoteDeleted.delete(`${c}/${k}`);
      else dels.push({ collection: c, id: k });
    }
  }
  if (prev.settings !== next.settings && !remoteRefs.has(next.settings)) {
    ups.push({ collection: "settings", id: "settings", data: next.settings });
  }
  return { ups, dels };
}

function applyRow(s: State, collection: string, id: string, data: any | null): State {
  if (collection === "settings") return data ? { ...s, settings: data } : s;
  if (!(ARRAY_KEYS as string[]).includes(collection)) return s;
  const c = collection as ArrayKey;
  const arr = s[c] as any[];
  const idx = arr.findIndex(item => keyOf(c, item) === id);
  let next: any[];
  if (data === null) next = idx < 0 ? arr : arr.filter((_, i) => i !== idx);
  else next = idx < 0 ? [...arr, data] : arr.map((item, i) => (i === idx ? data : item));
  return next === arr ? s : { ...s, [c]: next };
}

async function fetchAllRows(): Promise<Row[]> {
  const out: Row[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase!.from(TABLE).select("collection,id,data").order("seq").range(from, from + page - 1);
    if (error) throw error;
    out.push(...((data || []) as Row[]));
    if (!data || data.length < page) break;
  }
  return out;
}

async function upsertRows(rows: Row[], ignoreDuplicates = false) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map(({ collection, id, data }) => ({ collection, id, data }));
    const { error } = await supabase!.from(TABLE).upsert(chunk, { onConflict: "collection,id", ignoreDuplicates });
    if (error) throw error;
  }
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  const synced = useRef<State>(initial);                  // bản đã khớp với máy chủ (chỉ hiệu ứng ghi cập nhật)
  const pending = useRef<Map<string, number>>(new Map()); // số lần ghi chưa nhận echo realtime
  const remoteRefs = useRef<WeakSet<object>>(new WeakSet()); // bản ghi nhận từ máy khác
  const remoteDeleted = useRef<Set<string>>(new Set());      // khoá bị máy khác xoá

  // ---------- Chế độ localStorage (chưa cấu hình Supabase) ----------
  useEffect(() => {
    if (isSupabaseEnabled) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(withDefaults(JSON.parse(raw)));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (isSupabaseEnabled || !ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state, ready]);

  // ---------- Chế độ Supabase ----------
  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUid(session?.user.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Thay đổi từ máy khác: chỉ đi qua setState (không đụng `synced`) và được đánh dấu,
  // để hiệu ứng ghi không hiểu nhầm thành sửa/xoá cục bộ rồi ghi ngược lên máy chủ.
  const applyRemote = useCallback((collection: string, id: string, data: any | null) => {
    let value = data;
    if (value !== null) {
      if (collection === "settings") value = { ...initial.settings, ...value };
      if (value && typeof value === "object") remoteRefs.current.add(value);
    } else {
      remoteDeleted.current.add(`${collection}/${id}`);
    }
    setState(s => applyRow(s, collection, id, value));
  }, []);

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;
    if (!uid) {
      synced.current = initial;
      setState(initial);
      setReady(false);
      return;
    }
    let cancelled = false;
    const sb = supabase;
    setReady(false);

    const channel = sb.channel("app_records_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload: any) => {
        const isDelete = payload.eventType === "DELETE";
        const row = (isDelete ? payload.old : payload.new) as Row;
        if (!row?.collection) return;
        const k = `${row.collection}/${row.id}`;
        // Echo của chính lần ghi từ máy này → bỏ qua (tránh đè sửa đổi mới hơn)
        if (!isDelete && row.updated_by === uid && (pending.current.get(k) || 0) > 0) {
          pending.current.set(k, pending.current.get(k)! - 1);
          return;
        }
        applyRemote(row.collection, row.id, isDelete ? null : row.data);
      })
      .subscribe();

    (async () => {
      try {
        let rows = await fetchAllRows();
        if (!rows.some(r => r.collection === META)) {
          // Lần đầu: tạo dữ liệu mặc định (danh mục sản phẩm, tồn kho = 0, cấu hình…)
          await upsertRows([...stateToRows(initial), { collection: META, id: "seeded", data: { at: new Date().toISOString() } }], true);
          rows = await fetchAllRows();
        }
        // Dữ liệu đã nhập trên máy này trước đây (localStorage) → thêm lên máy chủ, không ghi đè bản đã có
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw && !localStorage.getItem(MIGRATED_KEY)) {
            const have = new Set(rows.map(r => `${r.collection}/${r.id}`));
            const local = stateToRows(withDefaults(JSON.parse(raw)))
              .filter(r => r.collection !== "settings" && !have.has(`${r.collection}/${r.id}`));
            if (local.length) { await upsertRows(local, true); rows = await fetchAllRows(); }
            localStorage.setItem(MIGRATED_KEY, new Date().toISOString());
          }
        } catch (e) { console.error("Không đẩy được dữ liệu cũ của máy này", e); }

        if (cancelled) return;
        const loaded = rowsToState(rows);
        synced.current = loaded;
        setState(loaded);
        setSyncError(null);
        setReady(true);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setSyncError(`Không tải được dữ liệu: ${e?.message || e}`);
      }
    })();

    return () => { cancelled = true; sb.removeChannel(channel); };
  }, [uid, applyRemote]);

  // Ghi thay đổi cục bộ lên máy chủ
  useEffect(() => {
    if (!isSupabaseEnabled || !supabase || !ready) return;
    const prev = synced.current;
    if (prev === state) return;
    synced.current = state;
    const { ups, dels } = diffStates(prev, state, remoteRefs.current, remoteDeleted.current);
    if (!ups.length && !dels.length) return;
    for (const r of ups) {
      const k = `${r.collection}/${r.id}`;
      pending.current.set(k, (pending.current.get(k) || 0) + 1);
    }
    const sb = supabase;
    (async () => {
      try {
        if (ups.length) await upsertRows(ups);
        const byCol = new Map<string, string[]>();
        for (const d of dels) byCol.set(d.collection, [...(byCol.get(d.collection) || []), d.id]);
        for (const [collection, ids] of Array.from(byCol.entries())) {
          const { error } = await sb.from(TABLE).delete().eq("collection", collection).in("id", ids);
          if (error) throw error;
        }
        setSyncError(null);
      } catch (e: any) {
        console.error(e);
        for (const r of ups) pending.current.delete(`${r.collection}/${r.id}`);
        setSyncError(`Lưu lên máy chủ thất bại: ${e?.message || e}. Tải lại trang để đồng bộ.`);
      }
    })();
  }, [state, ready]);

  const update = useCallback((fn: Updater) => setState(s => fn(s)), []);

  return <StoreCtx.Provider value={{ state, update, ready, syncError }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
