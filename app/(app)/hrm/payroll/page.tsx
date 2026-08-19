"use client";
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { StatusBadge } from "@/components/Badge";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { buildPayrollLine, recalcLine } from "@/lib/payroll";
import { formatMoney, formatNumber, monthISO, newId, todayISO, ROLE_LABEL } from "@/lib/utils";
import { CheckCircle2, Download, Play, Unlock, RotateCcw } from "lucide-react";
import type { PayrollLine, PayrollPeriod, Profile } from "@/types";

const GROUP_LABEL: Record<string, string> = {
  sale: "Sale & Quản lý",
  factory: "Nhân viên xưởng",
  standard: "Nhân viên kho & nhân viên thường",
};

// Ô thưởng/phạt dùng chung cho cả 3 nhóm: số tiền (âm = phạt) + lý do bắt buộc khi khác 0.
// Khai báo ở cấp module để React không remount input (mất focus) mỗi lần state đổi.
function AdjustmentCells({ line, editable, onChange }: {
  line: PayrollLine;
  editable: boolean;
  onChange: (patch: Partial<PayrollLine>) => void;
}) {
  const missingReason = line.adjustment !== 0 && !line.adjustmentReason?.trim();
  return (
    <>
      <td className="w-32">
        {editable
          ? <input type="number" step="1000" className="input" value={line.adjustment}
              onChange={e => onChange({ adjustment: Number(e.target.value) })} />
          : <span className={line.adjustment < 0 ? "text-red-600" : ""}>{formatMoney(line.adjustment)}</span>}
      </td>
      <td className="w-44">
        {editable
          ? <input className={`input ${missingReason ? "border-red-400" : ""}`}
              placeholder={line.adjustment !== 0 ? "Bắt buộc nhập lý do" : "—"}
              value={line.adjustmentReason || ""}
              onChange={e => onChange({ adjustmentReason: e.target.value })} />
          : <span className="text-gray-600">{line.adjustmentReason || "—"}</span>}
      </td>
    </>
  );
}

export default function PayrollPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const [period, setPeriod] = useState(monthISO());
  const isSelfOnly = !can(user?.role, "view_payroll");

  const [y, m] = period.split("-").map(Number);
  const existing = state.payrollPeriods.find(p => p.year === y && p.month === m);

  const makeLine = (profile: Profile, keep?: Parameters<typeof buildPayrollLine>[0]["keep"]): PayrollLine => ({
    ...buildPayrollLine({
      profile, year: y, month: m,
      orders: state.orders, receipts: state.receipts,
      attendance: state.attendance, productionDays: state.productionDays,
      settings: state.settings, keep,
    }),
    id: newId(),
  });

  const initPeriod = () => {
    const lines = state.profiles.filter(p => p.status === "active").map(p => makeLine(p));
    const newPeriod: PayrollPeriod = {
      id: newId(), code: `PL-${period}`, year: y, month: m, status: "draft", lines,
    };
    update(s => ({ ...s, payrollPeriods: [newPeriod, ...s.payrollPeriods] }));
  };

  // Tính lại từ dữ liệu gốc (đơn/phiếu thu/chấm công/SX) — giữ nguyên phần kế toán đã nhập tay.
  const recompute = () => {
    if (!existing) return;
    update(s => ({
      ...s,
      payrollPeriods: s.payrollPeriods.map(pp => pp.id === existing.id ? {
        ...pp,
        lines: pp.lines.map(line => {
          const profile = s.profiles.find(p => p.id === line.profileId);
          if (!profile) return line;
          return {
            ...buildPayrollLine({
              profile, year: y, month: m,
              orders: s.orders, receipts: s.receipts,
              attendance: s.attendance, productionDays: s.productionDays,
              settings: s.settings,
              keep: {
                adjustment: line.adjustment,
                adjustmentReason: line.adjustmentReason,
                commissionPct: line.commissionPct,
                debtCommissionPct: line.debtCommissionPct,
                extraBatchRate: line.extraBatchRate,
                overtimeDays: line.overtimeDays,
                overtimeDayRate: line.overtimeDayRate,
              },
            }),
            id: line.id,
          };
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
        lines: pp.lines.map(l => l.id === lineId ? recalcLine({ ...l, ...patch }) : l),
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

  const saleLines = visibleLines.filter(l => l.group === "sale");
  const factoryLines = visibleLines.filter(l => l.group === "factory_manager" || l.group === "factory_staff");
  const standardLines = visibleLines.filter(l => l.group === "standard");

  const grandTotal = visibleLines.reduce((s, l) => s + l.total, 0);
  const locked = existing?.status === "locked";
  const editable = !locked && !isSelfOnly && can(user?.role, "manage_payroll");

  const nameOf = (l: PayrollLine) => state.profiles.find(x => x.id === l.profileId)?.fullName || "—";
  const roleOf = (l: PayrollLine) => ROLE_LABEL[state.profiles.find(x => x.id === l.profileId)?.role || ""] || "—";

  const exportCSV = () => {
    if (!existing) return;
    const rows: string[] = [];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    rows.push(GROUP_LABEL.sale);
    rows.push(["NV", "Vai trò", "Lương cứng", "Đơn đã thu trong tháng", "% HH đơn", "HH đơn", "Công nợ kỳ trước đã thu", "% HH công nợ", "HH công nợ", "Thưởng/phạt", "Lý do", "Tổng"].map(esc).join(","));
    saleLines.forEach(l => rows.push([nameOf(l), roleOf(l), l.baseSalary, l.commissionBase, l.commissionPct, l.commissionAmount, l.debtCommissionBase, l.debtCommissionPct, l.debtCommissionAmount, l.adjustment, l.adjustmentReason, l.total].map(esc).join(",")));

    rows.push("");
    rows.push(GROUP_LABEL.factory);
    rows.push(["NV", "Cấp bậc", "Lương cứng", "Ngày trong tháng", "Ngày công", "Lương theo ngày công", "Số mẻ làm thêm", "Chi phí/mẻ", "Tiền mẻ làm thêm", "Ngày tăng ca", "Chi phí/ngày", "Tiền tăng ca", "Thưởng/phạt", "Lý do", "Tổng"].map(esc).join(","));
    factoryLines.forEach(l => rows.push([nameOf(l), l.group === "factory_manager" ? "Quản lý xưởng" : "Nhân viên xưởng", l.baseSalary, l.monthDays, l.workedDays, l.baseSalaryEarned, l.extraBatches, l.extraBatchRate, l.extraBatchesAmount, l.overtimeDays, l.overtimeDayRate, l.overtimeAmount, l.adjustment, l.adjustmentReason, l.total].map(esc).join(",")));

    rows.push("");
    rows.push(GROUP_LABEL.standard);
    rows.push(["NV", "Vai trò", "Lương cứng", "Thưởng/phạt", "Lý do", "Tổng"].map(esc).join(","));
    standardLines.forEach(l => rows.push([nameOf(l), roleOf(l), l.baseSalary, l.adjustment, l.adjustmentReason, l.total].map(esc).join(",")));

    rows.push("");
    rows.push([esc("TỔNG QUỸ LƯƠNG"), esc(grandTotal)].join(","));

    const csv = "﻿" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `bang-luong-${period}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const missingReasons = visibleLines.filter(l => l.adjustment !== 0 && !l.adjustmentReason?.trim());

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bảng lương"
        subtitle="3 nhóm: Sale & Quản lý (hoa hồng) • Xưởng (ngày công + mẻ + tăng ca) • Kho & NV thường (lương cứng) — chỉ Admin duyệt/khoá"
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

          {editable && missingReasons.length > 0 && (
            <div className="card p-3 text-sm text-red-600">
              {missingReasons.length} dòng có thưởng/phạt nhưng chưa ghi lý do: {missingReasons.map(nameOf).join(", ")}.
            </div>
          )}

          {/* ---------- Nhóm 1: Sale & Quản lý ---------- */}
          <div className="card">
            <div className="px-4 pt-3 pb-2">
              <h3 className="font-semibold">{GROUP_LABEL.sale}</h3>
              <p className="text-xs text-gray-500">Lương cứng + % hoa hồng trên tiền đơn hàng đã thu trong tháng + % hoa hồng trên công nợ kỳ trước thu được trong tháng + thưởng/phạt. Đơn chưa thanh toán không được tính.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead><tr>
                  <th>NV</th><th>Vai trò</th>
                  <th className="text-right">Lương cứng</th>
                  <th className="text-right">Đơn đã thu</th><th className="text-center">% HH</th><th className="text-right">HH đơn</th>
                  <th className="text-right">Công nợ kỳ trước đã thu</th><th className="text-center">% HH nợ</th><th className="text-right">HH công nợ</th>
                  <th>Thưởng / phạt</th><th>Lý do</th>
                  <th className="text-right">Tổng</th>
                </tr></thead>
                <tbody>
                  {saleLines.map(l => (
                    <tr key={l.id}>
                      <td className="font-medium whitespace-nowrap">{nameOf(l)}</td>
                      <td>{roleOf(l)}</td>
                      <td className="text-right">{formatMoney(l.baseSalary)}</td>
                      <td className="text-right text-gray-600">{formatMoney(l.commissionBase)}</td>
                      <td className="text-center w-20">
                        {editable
                          ? <input type="number" step="0.1" className="input text-center" value={l.commissionPct}
                              onChange={e => updateLine(l.id, { commissionPct: Number(e.target.value) })} />
                          : `${l.commissionPct}%`}
                      </td>
                      <td className="text-right">{formatMoney(l.commissionAmount)}</td>
                      <td className="text-right text-gray-600">{formatMoney(l.debtCommissionBase)}</td>
                      <td className="text-center w-20">
                        {editable
                          ? <input type="number" step="0.1" className="input text-center" value={l.debtCommissionPct}
                              onChange={e => updateLine(l.id, { debtCommissionPct: Number(e.target.value) })} />
                          : `${l.debtCommissionPct}%`}
                      </td>
                      <td className="text-right">{formatMoney(l.debtCommissionAmount)}</td>
                      <AdjustmentCells line={l} editable={editable} onChange={patch => updateLine(l.id, patch)} />
                      <td className="text-right font-semibold text-emerald-700">{formatMoney(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {saleLines.length === 0 && <EmptyState />}
            </div>
          </div>

          {/* ---------- Nhóm 2: Xưởng ---------- */}
          <div className="card">
            <div className="px-4 pt-3 pb-2">
              <h3 className="font-semibold">{GROUP_LABEL.factory}</h3>
              <p className="text-xs text-gray-500">Lương cứng = (lương cứng ÷ số ngày trong tháng) × số ngày đi làm, cộng ngày tăng ca và thưởng/phạt. Riêng <b>quản lý xưởng</b> có thêm mẻ làm thêm.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead><tr>
                  <th>NV</th><th>Cấp bậc</th>
                  <th className="text-right">Lương cứng</th>
                  <th className="text-center">Ngày công</th><th className="text-right">Lương theo ngày công</th>
                  <th className="text-center">Số mẻ thêm</th><th className="text-right">Chi phí/mẻ</th><th className="text-right">Tiền mẻ</th>
                  <th className="text-center">Ngày tăng ca</th><th className="text-right">Chi phí/ngày</th><th className="text-right">Tiền tăng ca</th>
                  <th>Thưởng / phạt</th><th>Lý do</th>
                  <th className="text-right">Tổng</th>
                </tr></thead>
                <tbody>
                  {factoryLines.map(l => {
                    const isManager = l.group === "factory_manager";
                    return (
                      <tr key={l.id}>
                        <td className="font-medium whitespace-nowrap">{nameOf(l)}</td>
                        <td><span className="badge-blue">{isManager ? "Quản lý xưởng" : "Nhân viên xưởng"}</span></td>
                        <td className="text-right">{formatMoney(l.baseSalary)}</td>
                        <td className="text-center w-28">
                          {editable
                            ? <div className="flex items-center gap-1 justify-center">
                                <input type="number" step="0.5" min="0" max={l.monthDays} className="input text-center w-16" value={l.workedDays}
                                  onChange={e => updateLine(l.id, { workedDays: Number(e.target.value) })} />
                                <span className="text-xs text-gray-400">/{l.monthDays}</span>
                              </div>
                            : `${formatNumber(l.workedDays, 1)}/${l.monthDays}`}
                        </td>
                        <td className="text-right">{formatMoney(l.baseSalaryEarned)}</td>
                        <td className="text-center w-20">
                          {isManager
                            ? (editable
                                ? <input type="number" min="0" className="input text-center" value={l.extraBatches}
                                    onChange={e => updateLine(l.id, { extraBatches: Number(e.target.value) })} />
                                : formatNumber(l.extraBatches))
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="text-right w-28">
                          {isManager
                            ? (editable
                                ? <input type="number" step="1000" className="input text-right" value={l.extraBatchRate}
                                    onChange={e => updateLine(l.id, { extraBatchRate: Number(e.target.value) })} />
                                : formatMoney(l.extraBatchRate))
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="text-right">{isManager ? formatMoney(l.extraBatchesAmount) : <span className="text-gray-300">—</span>}</td>
                        <td className="text-center w-20">
                          {editable
                            ? <input type="number" step="0.5" min="0" className="input text-center" value={l.overtimeDays}
                                onChange={e => updateLine(l.id, { overtimeDays: Number(e.target.value) })} />
                            : formatNumber(l.overtimeDays, 1)}
                        </td>
                        <td className="text-right w-28">
                          {editable
                            ? <input type="number" step="1000" className="input text-right" value={l.overtimeDayRate}
                                onChange={e => updateLine(l.id, { overtimeDayRate: Number(e.target.value) })} />
                            : formatMoney(l.overtimeDayRate)}
                        </td>
                        <td className="text-right">{formatMoney(l.overtimeAmount)}</td>
                        <AdjustmentCells line={l} editable={editable} onChange={patch => updateLine(l.id, patch)} />
                        <td className="text-right font-semibold text-emerald-700">{formatMoney(l.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {factoryLines.length === 0 && <EmptyState />}
            </div>
          </div>

          {/* ---------- Nhóm 3: Kho & nhân viên thường ---------- */}
          <div className="card">
            <div className="px-4 pt-3 pb-2">
              <h3 className="font-semibold">{GROUP_LABEL.standard}</h3>
              <p className="text-xs text-gray-500">Lương cứng + thưởng/phạt tuỳ chỉnh (ghi rõ lý do).</p>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead><tr>
                  <th>NV</th><th>Vai trò</th>
                  <th className="text-right">Lương cứng</th>
                  <th>Thưởng / phạt</th><th>Lý do</th>
                  <th className="text-right">Tổng</th>
                </tr></thead>
                <tbody>
                  {standardLines.map(l => (
                    <tr key={l.id}>
                      <td className="font-medium whitespace-nowrap">{nameOf(l)}</td>
                      <td>{roleOf(l)}</td>
                      <td className="text-right">{formatMoney(l.baseSalary)}</td>
                      <AdjustmentCells line={l} editable={editable} onChange={patch => updateLine(l.id, patch)} />
                      <td className="text-right font-semibold text-emerald-700">{formatMoney(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {standardLines.length === 0 && <EmptyState />}
            </div>
          </div>

          <div className="card p-3 text-xs text-gray-500 space-y-1">
            <div><b>Sale & Quản lý</b> = lương cứng + %HH × tiền thu được trong tháng của đơn phát sinh trong tháng + %HH nợ × tiền thu được trong tháng của đơn các tháng trước + thưởng/phạt. Chỉ tính phiếu thu <b>đã duyệt</b> (tiền thực về).</div>
            <div><b>Xưởng</b> = (lương cứng ÷ {new Date(y, m, 0).getDate()} ngày) × ngày công + số mẻ làm thêm × chi phí/mẻ (chỉ quản lý) + ngày tăng ca × chi phí/ngày + thưởng/phạt. Ngày công lấy từ Chấm công (nghỉ có phép vẫn tính, nửa ngày = 0.5, nghỉ không phép = 0) và sửa tay được.</div>
            <div><b>Kho & NV thường</b> = lương cứng + thưởng/phạt.</div>
            <div>Thưởng/phạt nhập số âm để trừ lương. Mặc định %HH lấy từ hồ sơ nhân viên, chi phí mẻ/tăng ca lấy từ Cài đặt — sửa tại đây chỉ ảnh hưởng tháng này.</div>
          </div>
        </>
      )}
    </div>
  );
}
