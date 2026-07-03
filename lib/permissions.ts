import type { Role } from "@/types";

export type Action =
  | "view_dashboard"
  | "view_customers"
  | "manage_customers"
  | "view_orders"
  | "manage_orders"
  | "view_receipts"
  | "create_receipt"
  | "approve_receipt" // RULE CỨNG: chỉ admin
  | "view_debts"
  | "view_leads"
  | "manage_leads"
  | "view_production"
  | "manage_production"
  | "manage_materials"
  | "view_materials"
  | "create_transfer"
  | "confirm_transfer"
  | "manage_recovery"
  | "view_warehouse_hn"
  | "view_payroll"
  | "manage_payroll"
  | "approve_payroll" // chỉ admin
  | "view_payroll_self"
  | "view_reports"
  | "view_financials" // Net Revenue / Net Profit / Cost — CHỈ admin
  | "manage_settings"
  | "manage_users";

const matrix: Record<Role, Action[]> = {
  admin: [
    "view_dashboard",
    "view_customers", "manage_customers",
    "view_orders", "manage_orders",
    "view_receipts", "create_receipt", "approve_receipt",
    "view_debts", "view_leads", "manage_leads",
    "view_production", "manage_production", "manage_materials", "view_materials",
    "create_transfer", "confirm_transfer", "manage_recovery",
    "view_warehouse_hn",
    "view_payroll", "manage_payroll", "approve_payroll", "view_payroll_self",
    "view_reports", "view_financials", "manage_settings", "manage_users",
  ],
  manager: [
    "view_dashboard",
    "view_customers", "manage_customers",
    "view_orders", "manage_orders",
    "view_receipts",
    "view_debts", "view_leads", "manage_leads",
    "view_production", "manage_production", "view_materials", "manage_materials",
    "create_transfer", "manage_recovery",
    "view_warehouse_hn",
    "view_payroll", "view_payroll_self",
    "view_reports",
  ],
  sale: [
    "view_dashboard",
    "view_customers", "manage_customers",
    "view_orders", "manage_orders",
    "view_receipts",
    "view_debts", "view_leads", "manage_leads",
    "view_payroll_self",
  ],
  warehouse_hn: [
    "view_dashboard",
    "view_customers",
    "view_orders", "manage_orders",
    "view_receipts", "create_receipt",
    "view_debts",
    "view_materials", "confirm_transfer", "view_warehouse_hn",
    "view_payroll_self",
  ],
  factory_da: [
    "view_dashboard",
    "view_production", "manage_production", "view_materials",
    "create_transfer", "manage_recovery",
    "view_payroll_self",
  ],
  accountant: [
    "view_dashboard",
    "view_customers", "view_orders", "view_receipts",
    "view_debts",
    "view_production", "view_materials",
    "view_warehouse_hn",
    "view_payroll", "manage_payroll",
    "view_reports",
  ],
};

export function can(role: Role | undefined, action: Action) {
  if (!role) return false;
  return matrix[role]?.includes(action) ?? false;
}
