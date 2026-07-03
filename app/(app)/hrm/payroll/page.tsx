"use client";
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { StatusBadge } from "@/components/Badge";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { calcSalePayroll, calcWarehousePayroll, calcFactoryPayroll } from "@/lib/payroll";
import { formatMoney, monthISO, newId, todayISO, ROLE_LABEL } from "@/lib/utils";
import { CheckCircle2, Download, Play, Unlock, RotateCcw } from "lucide-react";
import type { PayrollLine, PayrollPeriod, Profile } from "@/types";

export default function PayrollPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const [period, setPeriod] = useState(monthISO());
  const isSelfOnly = !can(user?.role, "view_payroll");

  const [y, m] = period.split("-").map(Number);
  const existing = state.payrollPeriods.find(p => p.year === y && p.month === m);

  const buildLine = (profile: Profile, attitudeOn?: boolean, otherBonus?: number): PayrollLine => {
    const common = { profile, year: y, month: m, attendance: state.attendance, settings: state.settings, otherBonus };
    if (profile.role === "sale" || profile.role === "manager") {
      return { ...calcSalePayroll({ ...common, orders: state.orders, receipts: state.receipts, credits: state.newCustomerCredits, attitudeOn }), id: newId() };
    }
    if (profile.role === "warehouse_hn") {
      return { ...calcWarehousePayroll({ ...common, orders: state.orders, receipts: state.receipts }), id: newId() };
    }
    if (profile.role === "factory_da") {
      return { ...calcFactoryPayroll({ ...common, productionDays: state.productionDays }), id: newId() };
    }
    // admin / accountant: chỉ lương cứng
    const off = 0;
    return {
      id: newId(), profileId: profile.id, baseSalary: profile.baseSalary,
      commissionAmount: 0, crossCommission: 0, newCustomerBonus: 0, extraBatchesBonus: 0,
      attitudeBonus: 0, otherBonus: otherBonus || 0, offDayDeduction: off,
      total: profile.baseSalary + (otherBonus || 0),
    };
  };

  const initPeriod = () => {
    const lines = state.profiles.filter(p => p.status === "active").map(p => buildLine(p));
    const newPeriod: PayrollPeriod = {
      id: newId(), code: `PL-${period}`, year: y, month: m, status: "draft", lines,
    };
    update(s => ({ ...s, payrollPeriods: [newPeriod, ...s.payrollPeriods] }));
  };

  const recompute = () => {
    if (!existing) return;
    update(s => ({
      ...s,
      payrollPeriods: s.payrollPeriods.map(pp => pp.id === existing.id ? {
        ...pp,
        lines: pp.lines.map(line => {
          const profile = s.profiles.find(p => p.id === line.profileId)!;
          const rebuilt = buildLine(profile, line.attitudeBonus > 0, line.otherBonus);
          return { ...rebuilt, id: line.id };
        }),
      } : pp),
    }));
  };

  const updateLine = (lineId: string, patch: Partial<PayrollLine>) => {
    if (!existing || existing.status === "locked") return;
    update(s => ({
      ...s,
      payrollPeriods: s.payrollPeriods.map(pp => pp.id === existing.id ? {
        ...pp,
        lines: pp.lines.map(l => {
          if (l.id !== lineId) return l;
          const merged = { ...l, ...patch };
          merged.total = merged.baseSalary + merged.commissionAmount + merged.crossCommission
            + merged.newCustomerBonus + merged.extraBatchesBonus + merged.attitudeBonus
            + merged.otherBonus - merged.offDayDeduction;
          return merged;
        }),
      } : pp),
    }));
  };

  const approve = () => {
    if (!existing) return;
    update(s => ({ ...s, payrollPeriods: s.payrollPeriods.map(pp => pp.id === existing.id ? { ...pp, status: "approved", approvedBy: user!.id, approvedAt: todayISO() } : pp) }));
  };
  const lock = () => {
    if (!existing) return;
    update(s => ({ ...s, payrollPeriods: s.payrollPeriods.map(pp => pp.id === existing.id ? { ...pp, status: "locked" } : pp) }));
  };
  const reopen = () => {
    if (!existing || !confirm("Mở lại bảng lương để sửa? (cần quyền Admin)")) return;
    update(s => ({ ...s, payrollPeriods: s.payrollPeriods.map(pp => pp.id === existing.id ? { ...pp, status: "draft" } : pp) }));
  };

  const visibleLines = useMemo(() => {
    if (!existing) return [];
    if (isSelfOnly) return existing.lines.filter(l => l.profileId === user?.id);
    return existing.lines;
  }, [existing, isSelfOnly, user]);

  const grandTotal = visibleLines.reduce((s, l) => s + l.total, 0);
  const locked = existing?.status === "locked";

  const exportCSV = () => {
    if (!existing) return;
    const headers = ["NV", "Vai trò", "Lương cứng", "Hoa hồng", "HH chéo", "Khách mới", "Mẻ bồi dưỡng", "Thái độ", "Khác", "Trừ nghỉ", "Tổng"];
    const lines = [headers.join(",")];
    visibleLines.forEach(l => {
      const p = state.profiles.find(x => x.id === l.profileId);
      lines.push([p?.fullName, ROLE_LABEL[p?.role || ""], l.baseSalary, l.commissionAmount, l.crossCommission, l.newCustomerBonus, l.extraBatchesBonus, l.attitudeBonus, l.otherBonus, l.offDayDeduction, l.total].join(","));
    });
    const csv = "﻿" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `bang-luong-${period}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bảng lương"
        subtitle="Sale (hoa hồng) + Kho (HH chéo) + Xưởng (mẻ bồi dưỡng) — chỉ Admin duyệt/khoá"
        actions={
          <>
            <input type="month" className="input w-44" value={period} onChange={e => setPeriod(e.target.value)} />
            {existing && <button className="btn-secondary" onClick={exportCSV}><Download className="h-4 w-4" /> Xuất CSV</button>}
          </>
        }
      />

      {!existing ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500 mb-3">Chưa có bảng lương tháng {period}.</p>
          {can(user?.role, "manage_payroll") && (
            <button className="btn-primary mx-auto" onClick={initPeriod}><Play className="h-4 w-4" /> Khởi tạo bảng lương tháng {period}</button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Trạng thái" value={<StatusBadge status={existing.status} />} />
            <StatCard label="Tổng quỹ lương" value={formatMoney(grandTotal)} />
            <StatCard label="Số nhân viên" value={visibleLines.length} />
            <StatCard label="Người duyệt" value={state.profiles.find(p => p.id === existing.approvedBy)?.fullName || "—"} />
          </div>

          {!isSelfOnly && can(user?.role, "manage_payroll") && (
            <div className="card p-3 flex flex-wrap gap-2 items-center">
              {!locked && <button className="btn-secondary" onClick={recompute}><RotateCcw className="h-4 w-4" /> Tính lại</button>}
              {existing.status !== "locked" && can(user?.role, "approve_payroll") && (
                <>
                  {existing.status === "draft" && <button className="btn-primary" onClick={approve}><CheckCircle2 className="h-4 w-4" /> Duyệt</button>}
                  {existing.status === "approved" && <button className="btn-primary" onClick={lock}><CheckCircle2 className="h-4 w-4" /> Khoá bảng lương</button>}
                </>
              )}
              {locked && can(user?.role, "approve_payroll") && <button className="btn-secondary" onClick={reopen}><Unlock className="h-4 w-4" /> Mở lại</button>}
              {locked && <span className="text-sm text-gray-500">Bảng lương đã khoá — không sửa được.</span>}
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead><tr>
                <th>NV</th><th>Vai trò</th>
                <th className="text-right">Lương cứng</th><th className="text-right">Hoa hồng</th>
                <th className="text-right">HH chéo</th><th className="text-right">Khách mới</th>
                <th className="text-right">Mẻ bồi dưỡng</th><th className="text-center">Thái độ</th>
                <th className="w-28">Khác</th><th className="text-right">Trừ nghỉ</th><th className="text-right">Tổng</th>
              </tr></thead>
              <tbody>
                {visibleLines.map(l => {
                  const p = state.profiles.find(x => x.id === l.profileId);
                  const editable = !locked && !isSelfOnly && can(user?.role, "manage_payroll");
                  return (
                    <tr key={l.id}>
                      <td className="font-medium">{p?.fullName}</td>
                      <td>{ROLE_LABEL[p?.role || ""]}</td>
                      <td className="text-right">{formatMoney(l.baseSalary)}</td>
                      <td className="text-right">{formatMoney(l.commissionAmount)}</td>
                      <td className="text-right">{formatMoney(l.crossCommission)}</td>
                      <td className="text-right">{formatMoney(l.newCustomerBonus)}</td>
                      <td className="text-right">{formatMoney(l.extraBatchesBonus)}</td>
                      <td className="text-center">
                        {(p?.role === "sale" || p?.role === "manager") ? (
                          editable
                            ? <input type="checkbox" checked={l.attitudeBonus > 0} onChange={e => updateLine(l.id, { attitudeBonus: e.target.checked ? state.settings.attitudeBonus : 0 })} />
                            : (l.attitudeBonus > 0 ? "✓" : "—")
                        ) : "—"}
                      </td>
                      <td>
                        {editable
                          ? <input type="number" className="input" value={l.otherBonus} onChange={e => updateLine(l.id, { otherBonus: Number(e.target.value) })} />
                          : formatMoney(l.otherBonus)}
                      </td>
                      <td className="text-right text-red-600">- {formatMoney(l.offDayDeduction)}</td>
                      <td className="text-right font-semibold text-emerald-700">{formatMoney(l.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visibleLines.length === 0 && <EmptyState />}
          </div>

          <div className="card p-3 text-xs text-gray-500">
            <b>Công thức:</b> Sale = lương cứng + {state.settings.defaultCommissionPct}% × (phiếu thu đã duyệt trong tháng, gồm công nợ tháng trước) + 100k×khách mới qualified + (thái độ {formatMoney(state.settings.attitudeBonus)}) + khác − trừ nghỉ. •
            Kho HN = lương cứng + {state.settings.crossCommissionPct}% × doanh thu net của sale được cấu hình (HH chéo). •
            Xưởng = lương cứng + mẻ vượt {state.settings.factoryBatchThreshold}/ngày × {formatMoney(state.settings.factoryExtraBatchBonus)}.
          </div>
        </>
      )}
    </div>
  );
}
