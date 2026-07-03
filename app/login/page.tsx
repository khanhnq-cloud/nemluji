"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { DEMO_USERS } from "@/lib/mock-data";
import { ROLE_LABEL } from "@/lib/utils";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@nnnt.vn");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const r = await login(email, password);
    setBusy(false);
    if (r.ok) router.replace("/dashboard");
    else setError(r.error || "Đăng nhập lỗi");
  };

  const quickPick = (e: { email: string; password: string }) => {
    setEmail(e.email);
    setPassword(e.password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-brand-50 to-white">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-6">
        <div className="card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-md bg-brand-600 text-white flex items-center justify-center font-bold text-lg">N</div>
            <div>
              <div className="font-semibold text-lg">Nem Luji Internal</div>
              <div className="text-sm text-gray-500">Webapp quản trị nội bộ</div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Mật khẩu</label>
              <input className="input" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Đang đăng nhập…" : "Đăng nhập"}
            </button>
          </form>
        </div>

        <div className="card p-6">
          <div className="font-semibold mb-1">Tài khoản demo</div>
          <div className="text-xs text-gray-500 mb-4">Click để điền sẵn. Mật khẩu: <code className="bg-gray-100 px-1 rounded">123456</code></div>
          <div className="space-y-1.5">
            {DEMO_USERS.map(u => (
              <button
                key={u.email}
                onClick={() => quickPick(u)}
                className="w-full flex items-center justify-between p-2.5 rounded-md border border-gray-200 hover:bg-gray-50 text-left"
              >
                <div>
                  <div className="text-sm font-medium">{u.fullName}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </div>
                <span className="badge-blue">{ROLE_LABEL[u.role]}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 text-xs text-gray-500">
            App đang chạy mock data (localStorage). Khi nối Supabase, set <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> + ANON_KEY và chạy schema trong <code className="bg-gray-100 px-1 rounded">supabase-schema.sql</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
