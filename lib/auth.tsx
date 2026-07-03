"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { DEMO_USERS, PROFILES } from "./mock-data";
import type { Profile } from "@/types";

type Ctx = {
  user: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
};

const AuthCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "nnnt_user_v2";
const STORE_KEY = "nnnt_state_v5"; // đọc profiles đã chỉnh/thêm trong store
const DEFAULT_PASSWORD = "123456";

// Tìm profile trong store (cho user được admin thêm/sửa ở /users)
function findStoreProfile(email: string): Profile | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    const profiles: Profile[] = state.profiles || [];
    return profiles.find(p => p.email?.toLowerCase() === email.toLowerCase() && p.status === "active") || null;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
    setLoading(false);
  }, []);

  const login: Ctx["login"] = async (email, password) => {
    // 1) Tài khoản demo gốc
    const u = DEMO_USERS.find(x => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
    let profile: Profile | undefined = u ? PROFILES.find(p => p.id === u.profileId) : undefined;

    // 2) Fallback: user được thêm/sửa ở /users (mật khẩu mặc định 123456)
    if (!profile && password === DEFAULT_PASSWORD) {
      profile = findStoreProfile(email) || undefined;
    }
    // Ưu tiên bản ghi mới nhất trong store nếu có (email/role đã chỉnh)
    if (profile) {
      const fresh = findStoreProfile(profile.email);
      if (fresh) profile = fresh;
    }

    if (!profile) return { ok: false, error: "Sai email hoặc mật khẩu" };
    setUser(profile);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch {}
    return { ok: true };
  };

  const logout = () => {
    setUser(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return <AuthCtx.Provider value={{ user, loading, login, logout }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
