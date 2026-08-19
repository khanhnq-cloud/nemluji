"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, Receipt, CreditCard, Users, CalendarClock,
  Target, Footprints, Factory, Package, ArrowLeftRight, Recycle,
  Warehouse, Wallet, FileBarChart, Settings, ShieldCheck, HandCoins, FlaskConical,
  ChevronDown, BookOpen,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { can, type Action } from "@/lib/permissions";
import { calcDaysLeftBadges } from "@/lib/badges";

type Item = { href: string; label: string; icon: any; perm?: Action; badge?: "receipts" | "nvl" };
type Group = { title?: string; items: Item[] };
// Mega = danh mục lớn (co/giãn được); flat = nhóm phẳng như hiện tại
type Mega = { kind: "mega"; title: string; icon: any; groups: Group[] } | { kind: "flat"; title?: string; items: Item[] };

const NAV: Mega[] = [
  { kind: "flat", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "view_dashboard" },
  ]},
  { kind: "mega", title: "Kho Cát Linh", icon: Warehouse, groups: [
    { title: "Bán hàng", items: [
      { href: "/sales/orders",   label: "Đơn hàng", icon: ShoppingCart, perm: "view_orders" },
      { href: "/sales/receipts", label: "Phiếu thu", icon: Receipt,     perm: "view_receipts", badge: "receipts" },
      { href: "/sales/debts",    label: "Công nợ",   icon: CreditCard,  perm: "view_debts" },
    ]},
    { title: "Khách hàng", items: [
      { href: "/customers", label: "Khách & chi nhánh", icon: Users, perm: "view_customers" },
      { href: "/customers/forecast", label: "Dự báo lịch order", icon: CalendarClock, perm: "view_customers" },
    ]},
    { title: "Team Sale", items: [
      { href: "/team-sales/leads",   label: "Lead",          icon: Target,       perm: "view_leads" },
      { href: "/team-sales/samples", label: "Hàng phát thử", icon: FlaskConical, perm: "view_leads" },
    ]},
    { title: "Kho", items: [
      { href: "/warehouse-hn", label: "Kho Cát Linh", icon: Warehouse, perm: "view_warehouse_hn" },
    ]},
  ]},
  { kind: "mega", title: "Xưởng", icon: Factory, groups: [
    { items: [
      { href: "/production/days",      label: "Sổ Xưởng",           icon: BookOpen,       perm: "view_production" },
      { href: "/production/materials", label: "NVL & tồn",          icon: Package,        perm: "view_materials", badge: "nvl" },
      { href: "/production/transfers", label: "Chuyển kho",         icon: ArrowLeftRight, perm: "view_materials" },
      { href: "/production/recovery",  label: "Recover / Tiêu huỷ", icon: Recycle,        perm: "view_production" },
    ]},
  ]},
  { kind: "flat", title: "HRM", items: [
    { href: "/hrm/payroll",    label: "Bảng lương", icon: Wallet,     perm: "view_payroll_self" },
    { href: "/hrm/attendance", label: "Chấm công",  icon: Footprints, perm: "view_payroll" },
  ]},
  { kind: "flat", title: "Tài chính", items: [
    { href: "/expenses", label: "Phiếu chi", icon: HandCoins, perm: "view_expenses" },
  ]},
  { kind: "flat", title: "Khác", items: [
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const allow = (i: Item) => !i.perm || can(user?.role, i.perm);
  const badgeOf = (b?: Item["badge"]) => b === "receipts" ? badges.pendingReceipts : b === "nvl" ? badges.lowMaterials : 0;

  const renderItem = (it: Item) => {
    const active = pathname === it.href || (it.href !== "/dashboard" && pathname.startsWith(it.href + "/"));
    const Icon = it.icon;
    const count = badgeOf(it.badge);
    return (
      <Link
        key={it.href}
        href={it.href}
        onClick={onClose}
        className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm ${active ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-700 hover:bg-gray-100"}`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{it.label}</span>
        {count > 0 && <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-medium">{count}</span>}
      </Link>
    );
  };

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
          {NAV.map((sec, idx) => {
            if (sec.kind === "flat") {
              const items = sec.items.filter(allow);
              if (items.length === 0) return null;
              return (
                <div key={sec.title || `flat-${idx}`}>
                  {sec.title && <div className="px-2 text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">{sec.title}</div>}
                  <div className="space-y-0.5">{items.map(renderItem)}</div>
                </div>
              );
            }

            // mega
            const groups = sec.groups
              .map(g => ({ ...g, items: g.items.filter(allow) }))
              .filter(g => g.items.length > 0);
            if (groups.length === 0) return null;
            const isCollapsed = !!collapsed[sec.title];
            const Icon = sec.icon;
            const pendingBadge = groups.reduce((sum, g) => sum + g.items.reduce((s, it) => s + badgeOf(it.badge), 0), 0);
            const hasActive = groups.some(g => g.items.some(it => pathname === it.href || pathname.startsWith(it.href + "/")));
            return (
              <div key={sec.title} className="rounded-md">
                <button
                  onClick={() => setCollapsed(c => ({ ...c, [sec.title]: !c[sec.title] }))}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm font-semibold ${hasActive ? "text-brand-700" : "text-gray-800"} hover:bg-gray-100`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{sec.title}</span>
                  {isCollapsed && pendingBadge > 0 && <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-medium">{pendingBadge}</span>}
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                </button>
                {!isCollapsed && (
                  <div className="mt-1 ml-2 pl-2 border-l border-gray-200 space-y-2">
                    {groups.map((g, gi) => (
                      <div key={g.title || `g-${gi}`}>
                        {g.title && <div className="px-2 text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-0.5">{g.title}</div>}
                        <div className="space-y-0.5">{g.items.map(renderItem)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
