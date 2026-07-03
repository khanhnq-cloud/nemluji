"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import type {
  Profile, Customer, CustomerBranch, Product, Order, Receipt,
  DebtStatement, Lead, Material, ProductionRecipe, ProductionDay,
  StockTransfer, ClInventory, Attendance, PayrollPeriod, RecoveryLog,
  DestructionLog, NewCustomerCredit, AppSettings, Expense,
} from "@/types";
import {
  PROFILES, CUSTOMERS, CUSTOMER_BRANCHES, PRODUCTS, ORDERS, RECEIPTS,
  DEBT_STATEMENTS, LEADS, MATERIALS, RECIPES, PRODUCTION_DAYS,
  STOCK_TRANSFERS, CL_INVENTORY, FACTORY_INVENTORY, RECOVERY_LOGS, DESTRUCTION_LOGS,
  ATTENDANCE, PAYROLL_PERIODS, NEW_CUSTOMER_CREDITS, DEFAULT_SETTINGS, EXPENSES,
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
  expenses: Expense[];
  recoveryLogs: RecoveryLog[];
  destructionLogs: DestructionLog[];
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
  expenses: EXPENSES,
  recoveryLogs: RECOVERY_LOGS,
  destructionLogs: DESTRUCTION_LOGS,
  attendance: ATTENDANCE,
  payrollPeriods: PAYROLL_PERIODS,
  newCustomerCredits: NEW_CUSTOMER_CREDITS,
  settings: DEFAULT_SETTINGS,
};

const STORAGE_KEY = "nnnt_state_v5";
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) setState({ ...initial, ...JSON.parse(raw) });
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
