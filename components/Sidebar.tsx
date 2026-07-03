"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, Receipt, CreditCard, Users, CalendarClock,
  Target, Footprints, FlaskConical, Factory, Package, ArrowLeftRight, Recycle,
  Warehouse, Wallet, FileBarChart, Settings, ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { can, type Action } from "@/lib/permissions";
import { calcDaysLeftBadges } from "@/lib/badges";

type Item = { href: string; label: string; icon: any; perm?: Action; badge?: "receipts" | "nvl" };
type Section = { title: string; items: Item[] };

const SECTIONS: Section[] = [
  { title: "Tổng quan", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "view_dashboard" },
  ]},
  { title: "Bán hàng", items: [
    { href: "/sales/orders",   label: "Đơn hàng", icon: ShoppingCart, perm: "view_orders" },
    { href: "/sales/receipts", label: "Phiếu thu", icon: Receipt,     perm: "view_receipts", badge: "receipts" },
    { href: "/sales/debts",    label: "Công nợ",   icon: CreditCard,  perm: "view_debts" },
  ]},
  { title: "Khách hàng", items: [
    { href: "/customers", label: "Khách & chi nhánh", icon: Users,         perm: "view_customers" },
    { href: "/customers/forecast", label: "Dự báo lịch order", icon: CalendarClock, perm: "view_customers" },
  ]},
  { title: "Team Sale", items: [
    { href: "/team-sales/leads",   label: "Lead",          icon: Target,    perm: "view_leads" },
    { href: "/team-sales/samples", label: "Hàng phát thử", icon: FlaskConical, perm: "view_leads" },
  ]},
  { title: "Sản xuất", items: [
    { href: "/production/days",        label: "Mẻ sản xuất",   icon: Factory,        perm: "view_production" },
    { href: "/production/materials",   label: "NVL & tồn xưởng", icon: Package,      perm: "view_materials", badge: "nvl" },
    { href: "/production/transfers",   label: "Chuyển kho",    icon: ArrowLeftRight, perm: "view_materials" },
    { href: "/production/recovery",    label: "Recover / Tiêu huỷ", icon: Recycle,   perm: "manage_recovery" },
  ]},
  { title: "Kho Hà Nội", items: [
    { href: "/warehouse-hn", label: "Kho CL (Hà Nội)", icon: Warehouse, perm: "view_warehouse_hn" },
  ]},
  { title: "HRM", items: [
    { href: "/hrm/payroll",    label: "Bảng lương", icon: Wallet,        perm: "view_payroll_self" },
    { href: "/hrm/attendance", label: "Chấm công",  icon: Footprints,    perm: "view_payroll" },
  ]},
  { title: "Khác", items: [
    { href: "/reports",  label: "Báo cáo",    icon: FileBarChart, perm: "view_reports" },
    { href: "/users",    label: "Người dùng", icon: ShieldCheck,  perm: "manage_users" },
    { href: "/settings", label: "Cài đặt",    icon: Settings,     perm: "manage_settings" },
  ]},
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { state } = useStore();
  const badges = calcDaysLeftBadges(state);

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r border-gray-200 z-40 transform transition-transform overflow-y-auto ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-brand-600 text-white flex items-center justify-center font-bold">N</div>
            <div>
              <div className="text-sm font-semibold">NNNT-CRM</div>
              <div className="text-xs text-gray-500">Nem nướng Nha Trang</div>
            </div>
          </div>
        </div>
        <nav className="p-3 space-y-4">
          {SECTIONS.map(sec => {
            const items = sec.items.filter(i => !i.perm || can(user?.role, i.perm));
            if (items.length === 0) return null;
            return (
              <div key={sec.title}>
                <div className="px-2 text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">{sec.title}</div>
                <div className="space-y-0.5">
                  {items.map(it => {
                    const active = pathname === it.href || (it.href !== "/dashboard" && pathname.startsWith(it.href + "/"));
                    const Icon = it.icon;
                    const badgeCount = it.badge === "receipts" ? badges.pendingReceipts : it.badge === "nvl" ? badges.lowMaterials : 0;
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        onClick={onClose}
                        className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm ${active ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-700 hover:bg-gray-100"}`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{it.label}</span>
                        {badgeCount > 0 && (
                          <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-medium">{badgeCount}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
