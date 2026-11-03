import type { Action } from "./permissions";

// Quyền cần có để MỞ từng trang (khớp với menu Sidebar).
// AppShell chặn khi gõ thẳng URL, không chỉ ẩn link.
export const ROUTE_PERMS: { prefix: string; perm: Action }[] = [
  { prefix: "/dashboard", perm: "view_dashboard" },
  { prefix: "/sales/orders", perm: "view_orders" },
  { prefix: "/sales/receipts", perm: "view_receipts" },
  { prefix: "/sales/debts", perm: "view_debts" },
  { prefix: "/customers", perm: "view_customers" },
  { prefix: "/team-sales", perm: "view_leads" },
  { prefix: "/warehouse-hn", perm: "view_warehouse_hn" },
  { prefix: "/production/days", perm: "view_production" },
  { prefix: "/production/materials", perm: "view_materials" },
  { prefix: "/production/transfers", perm: "view_materials" },
  { prefix: "/production/recovery", perm: "view_production" },
  { prefix: "/hrm/payroll", perm: "view_payroll_self" },
  { prefix: "/hrm/attendance", perm: "view_payroll" },
  { prefix: "/expenses", perm: "view_expenses" },
  { prefix: "/reports", perm: "view_reports" },
  { prefix: "/users", perm: "manage_users" },
  { prefix: "/settings", perm: "manage_settings" },
];

export function permForPath(pathname: string): Action | null {
  const match = ROUTE_PERMS
    .filter(r => pathname === r.prefix || pathname.startsWith(r.prefix + "/"))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match?.perm ?? null;
}
