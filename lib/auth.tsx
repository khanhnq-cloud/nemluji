"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { PROFILES } from "./mock-data";
import { supabase, isSupabaseEnabled } from "./supabase";
import type { Profile } from "@/types";

type Ctx = {
  user: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
};

const AuthCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "nnnt_user_v2"; // chỉ dùng để dọn session mock cũ

// Lấy profile từ bảng `profiles` theo auth uid. Phần nghiệp vụ vẫn dùng mock store
// (tham chiếu bằng id "u_*"), nên nếu email trùng profile mock thì giữ id mock.
async function loadSupabaseProfile(uid: string, email: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error || !data || data.status !== "active") return null;
  const mock = PROFILES.find(p => p.email.toLowerCase() === email.toLowerCase());
  return {
    ...(mock || {}),
    id: mock?.id ?? data.id,
    fullName: data.full_name ?? mock?.fullName ?? email,
    email: data.email ?? email,
    role: data.role,
    baseSalary: Number(data.base_salary ?? 0),
    commissionPct: Number(data.commission_pct ?? 0),
    debtCommissionPct: data.debt_commission_pct != null ? Number(data.debt_commission_pct) : mock?.debtCommissionPct,
    region: data.region ?? mock?.region,
    factoryLevel: data.factory_level ?? mock?.factoryLevel,
    status: data.status,
  } as Profile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isSupabaseEnabled && supabase) {
        const { data } = await supabase.auth.getSession();
        const s = data.session;
        const profile = s ? await loadSupabaseProfile(s.user.id, s.user.email ?? "") : null;
        if (!cancelled) setUser(profile);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const login: Ctx["login"] = async (email, password) => {
    // Supabase Auth
    if (isSupabaseEnabled && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) return { ok: false, error: "Sai email hoặc mật khẩu" };
      const profile = await loadSupabaseProfile(data.user.id, data.user.email ?? email);
      if (!profile) {
        await supabase.auth.signOut();
        return { ok: false, error: "Tài khoản chưa có hồ sơ hoặc đã bị khoá" };
      }
      setUser(profile);
      return { ok: true };
    }

    return { ok: false, error: "Chưa cấu hình Supabase (thiếu NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)" };
  };

  const logout = () => {
    setUser(null);
    if (isSupabaseEnabled && supabase) void supabase.auth.signOut();
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return <AuthCtx.Provider value={{ user, loading, login, logout }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

