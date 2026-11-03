"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import EmptyState from "./EmptyState";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { permForPath } from "@/lib/routes";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user, loading } = useAuth();
  const { ready, syncError } = useStore();
  const router = useRouter();
  const pathname = usePathname() || "";

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user || !ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 text-gray-500 p-4 text-center">
        <div>{loading || !user ? "Đang tải…" : "Đang tải dữ liệu…"}</div>
        {syncError && <div className="text-sm text-red-600 max-w-md">{syncError}</div>}
      </div>
    );
  }

  // Chặn truy cập trang ngoài quyền (kể cả khi gõ thẳng URL)
  const perm = permForPath(pathname);
  const allowed = !perm || can(user.role, perm);

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header onMenu={() => setOpen(true)} />
        {syncError && (
          <div className="px-4 lg:px-6 py-2 text-sm bg-red-50 text-red-700 border-b border-red-200">{syncError}</div>
        )}
        <main className="p-4 lg:p-6 flex-1">
          {allowed ? children : (
            <div className="card p-6"><EmptyState title="Bạn không có quyền truy cập trang này" hint="Liên hệ Admin nếu cần được cấp quyền." /></div>
          )}
        </main>
      </div>
    </div>
  );
}
