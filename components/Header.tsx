"use client";
import { Menu, LogOut, RefreshCcw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function Header({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const { reset } = useStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleReset = () => {
    if (confirm("Reset toàn bộ dữ liệu demo về mặc định?")) reset();
  };

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
      <div className="h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="lg:hidden btn-ghost p-2" onClick={onMenu} aria-label="menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-sm text-gray-500 hidden sm:block">Webapp quản trị nội bộ</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost btn-sm" onClick={handleReset} title="Reset dữ liệu demo">
            <RefreshCcw className="h-3.5 w-3.5" /> Reset demo
          </button>
          <div className="hidden sm:flex flex-col items-end text-right">
            <div className="text-sm font-medium">{user?.fullName}</div>
            <div className="text-xs text-gray-500">{ROLE_LABEL[user?.role ?? ""] ?? user?.role}</div>
          </div>
          <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold">
            {user?.fullName?.slice(0, 1) ?? "?"}
          </div>
          <button className="btn-ghost p-2" onClick={handleLogout} title="Đăng xuất">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
