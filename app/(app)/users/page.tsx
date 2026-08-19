"use client";
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badge";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ROLE_LABEL, formatMoney, formatPct, newId } from "@/lib/utils";
import { REGIONS } from "@/lib/mock-data";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Profile, Role } from "@/types";

const ROLES = Object.keys(ROLE_LABEL) as Role[];

export default function UsersPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const canManage = can(user?.role, "manage_users");

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const blank = (): Partial<Profile> => ({
    role: "sale", status: "active", baseSalary: 0,
    commissionPct: state.settings.defaultCommissionPct,
    debtCommissionPct: state.settings.defaultDebtCommissionPct,
  });
  const [f, setF] = useState<Partial<Profile>>(blank());

  const openAdd = () => { setEditId(null); setF(blank()); setOpen(true); };
  const openEdit = (p: Profile) => { setEditId(p.id); setF({ ...p }); setOpen(true); };

  const usageOf = (id: string) => {
    const orders = state.orders.filter(o => o.saleId === id).length;
    const customers = state.customers.filter(c => c.assignedSaleId === id).length;
    const leads = state.leads.filter(l => l.saleId === id).length;
    const approvals = state.receipts.filter(r => r.approvedBy === id).length;
    const production = state.productionDays.filter(d => d.closedBy === id).length;
    return orders + customers + leads + approvals + production;
  };

  const submit = () => {
    if (!f.fullName || !f.email) { alert("Họ tên và email là bắt buộc"); return; }
    const dupe = state.profiles.some(p => p.email.toLowerCase() === f.email!.toLowerCase() && p.id !== editId);
    if (dupe) { alert("Email đã tồn tại"); return; }
    const role = (f.role as Role) || "sale";
    const isSaleGroup = role === "sale" || role === "manager";
    const profile: Profile = {
      id: editId || newId(),
      fullName: f.fullName!,
      email: f.email!,
      role,
      baseSalary: Number(f.baseSalary || 0),
      commissionPct: isSaleGroup ? Number(f.commissionPct || 0) : 0,
      debtCommissionPct: isSaleGroup ? Number(f.debtCommissionPct || 0) : undefined,
      factoryLevel: role === "factory_da" ? (f.factoryLevel || "staff") : undefined,
      region: f.region || undefined,
      status: (f.status as Profile["status"]) || "active",
    };
    update(s => editId
      ? { ...s, profiles: s.profiles.map(p => p.id === editId ? profile : p) }
      : { ...s, profiles: [...s.profiles, profile] }
    );
    setOpen(false);
    setF(blank());
  };

  const remove = (p: Profile) => {
    if (p.id === user?.id) { alert("Không thể xoá chính tài khoản đang đăng nhập."); return; }
    const used = usageOf(p.id);
    if (used > 0) {
      alert(`Không thể xoá: "${p.fullName}" đang gắn với ${used} chứng từ (đơn/khách/lead/duyệt/SX). Hãy đặt trạng thái "Ngưng" thay vì xoá.`);
      return;
    }
    if (!confirm(`Xoá người dùng "${p.fullName}"?`)) return;
    update(s => ({ ...s, profiles: s.profiles.filter(x => x.id !== p.id) }));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Người dùng"
        subtitle="Quản lý hồ sơ & tài khoản (6 vai trò). Mật khẩu mặc định: 123456"
        actions={canManage && <button className="btn-primary" onClick={openAdd}><Plus className="h-4 w-4" /> Thêm người dùng</button>}
      />

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr>
            <th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Khu vực</th>
            <th className="text-right">Lương cứng</th><th className="text-right">% HH đơn</th><th className="text-right">% HH công nợ</th>
            <th>Trạng thái</th><th>Mật khẩu</th>{canManage && <th></th>}
          </tr></thead>
          <tbody>
            {state.profiles.map(p => (
              <tr key={p.id}>
                <td className="font-medium">{p.fullName}{p.id === user?.id && <span className="badge-blue ml-1">Bạn</span>}</td>
                <td>{p.email}</td>
                <td>
                  <span className="badge-blue">{ROLE_LABEL[p.role]}</span>
                  {p.role === "factory_da" && <span className="badge-gray ml-1">{p.factoryLevel === "manager" ? "Quản lý" : "Nhân viên"}</span>}
                </td>
                <td>{p.region || "—"}</td>
                <td className="text-right">{formatMoney(p.baseSalary)}</td>
                <td className="text-right">{p.commissionPct ? formatPct(p.commissionPct) : "—"}</td>
                <td className="text-right">{p.debtCommissionPct ? formatPct(p.debtCommissionPct) : "—"}</td>
                <td><StatusBadge status={p.status} /></td>
                <td><code className="bg-gray-100 px-2 py-0.5 rounded text-xs">123456</code></td>
                {canManage && (
                  <td className="whitespace-nowrap space-x-1">
                    <button className="btn-ghost btn-sm" onClick={() => openEdit(p)} title="Sửa"><Pencil className="h-3.5 w-3.5" /></button>
                    <button className="btn-ghost btn-sm text-red-600" onClick={() => remove(p)} title="Xoá"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {state.profiles.length === 0 && <EmptyState />}
      </div>

      {!canManage && (
        <div className="card p-3 text-xs text-gray-500">
          Chỉ <b>Admin</b> được thêm / sửa / xoá người dùng. Rule cứng: chỉ Admin duyệt phiếu thu & duyệt/khoá bảng lương.
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Sửa người dùng" : "Thêm người dùng"} size="lg" footer={
        <>
          <button className="btn-secondary" onClick={() => setOpen(false)}>Huỷ</button>
          <button className="btn-primary" onClick={submit}>{editId ? "Lưu thay đổi" : "Thêm"}</button>
        </>
      }>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Họ tên *</label><input className="input" value={f.fullName || ""} onChange={e => setF(x => ({ ...x, fullName: e.target.value }))} /></div>
          <div><label className="label">Email *</label><input className="input" type="email" value={f.email || ""} onChange={e => setF(x => ({ ...x, email: e.target.value }))} /></div>
          <div>
            <label className="label">Vai trò *</label>
            <select className="input" value={f.role} onChange={e => setF(x => ({ ...x, role: e.target.value as Role }))}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Khu vực</label>
            <select className="input" value={f.region || ""} onChange={e => setF(x => ({ ...x, region: e.target.value }))}>
              <option value="">— không —</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div><label className="label">Lương cứng (đ)</label><input type="number" className="input" value={f.baseSalary ?? 0} onChange={e => setF(x => ({ ...x, baseSalary: Number(e.target.value) }))} /></div>
          {(f.role === "sale" || f.role === "manager") && (
            <>
              <div><label className="label">% Hoa hồng đơn hàng</label><input type="number" step="0.1" className="input" value={f.commissionPct ?? 0} onChange={e => setF(x => ({ ...x, commissionPct: Number(e.target.value) }))} /></div>
              <div><label className="label">% Hoa hồng công nợ kỳ trước</label><input type="number" step="0.1" className="input" value={f.debtCommissionPct ?? 0} onChange={e => setF(x => ({ ...x, debtCommissionPct: Number(e.target.value) }))} /></div>
            </>
          )}
          {f.role === "factory_da" && (
            <div>
              <label className="label">Cấp bậc xưởng *</label>
              <select className="input" value={f.factoryLevel || "staff"} onChange={e => setF(x => ({ ...x, factoryLevel: e.target.value as Profile["factoryLevel"] }))}>
                <option value="staff">Nhân viên xưởng</option>
                <option value="manager">Quản lý xưởng (có mẻ làm thêm)</option>
              </select>
            </div>
          )}
          <div>
            <label className="label">Trạng thái</label>
            <select className="input" value={f.status} onChange={e => setF(x => ({ ...x, status: e.target.value as Profile["status"] }))}>
              <option value="active">Hoạt động</option>
              <option value="inactive">Ngưng</option>
            </select>
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-3">
          Mật khẩu đăng nhập mặc định cho mọi tài khoản là <code className="bg-gray-100 px-1 rounded">123456</code>. Người dùng mới có thể đăng nhập ngay sau khi tạo.
        </div>
      </Modal>
    </div>
  );
}
