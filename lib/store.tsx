"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
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
type Ctx = { state: State; update: (fn: Updater) => void; reset: () => void };

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

// v7: Sổ Xưởng (ProductionDay đổi cấu trúc) + MCK + kho recover + cấu hình xưởng.
// Dữ liệu localStorage cũ không tương thích nên đổi key để nạp lại mặc định.
// v8: dọn sạch mock data (chỉ còn danh mục + 2 tài khoản) → bỏ dữ liệu localStorage cũ.
const STORAGE_KEY = "nnnt_state_v8";
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const saved = JSON.parse(raw) as Partial<State>;
        // settings merge sâu để cấu hình mới thêm sau này vẫn có giá trị mặc định
        setState({ ...initial, ...saved, settings: { ...initial.settings, ...(saved.settings || {}) } });
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state, hydrated]);

  const update = (fn: Updater) => setState(s => fn(s));
  const reset = () => {
    setState(initial);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return <StoreCtx.Provider value={{ state, update, reset }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
