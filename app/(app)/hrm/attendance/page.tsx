"use client";
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useStore } from "@/lib/store";
import { ATTENDANCE_LABEL, ROLE_LABEL, monthISO, newId, todayISO } from "@/lib/utils";
import type { Attendance } from "@/types";

const KEYS = ["work", "off_paid", "off_unpaid", "half"] as const;
const COLOR: Record<string, string> = {
  work: "bg-emerald-100 text-emerald-700",
  off_paid: "bg-amber-100 text-amber-700",
  off_unpaid: "bg-red-100 text-red-700",
  half: "bg-blue-100 text-blue-700",
};
const SHORT: Record<string, string> = { work: "✓", off_paid: "P", off_unpaid: "X", half: "½" };

export default function AttendancePage() {
  const { state, update } = useStore();
  const [period, setPeriod] = useState(monthISO());

  const days = useMemo(() => {
    const [yy, mm] = period.split("-").map(Number);
    const last = new Date(yy, mm, 0).getDate();
    return Array.from({ length: last }, (_, i) => `${period}-${String(i + 1).padStart(2, "0")}`);
  }, [period]);

  const employees = state.profiles.filter(p => p.status === "active" && p.role !== "admin");

  const getStatus = (pid: string, date: string): Attendance["status"] =>
    state.attendance.find(a => a.profileId === pid && a.workDate === date)?.status || "work";

  const cycle = (pid: string, date: string) => {
    const cur = getStatus(pid, date);
    const next = KEYS[(KEYS.indexOf(cur) + 1) % KEYS.length];
    update(s => {
      const idx = s.attendance.findIndex(a => a.profileId === pid && a.workDate === date);
      if (idx >= 0) { const arr = [...s.attendance]; arr[idx] = { ...arr[idx], status: next }; return { ...s, attendance: arr }; }
      return { ...s, attendance: [...s.attendance, { id: newId(), profileId: pid, workDate: date, status: next }] };
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chấm công"
        subtitle="Mặc định = Làm. Click ô để xoay: Làm → Có phép → Không phép → Nửa ngày"
        actions={<input type="month" className="input w-44" value={period} onChange={e => setPeriod(e.target.value)} />}
      />
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr>
            <th className="sticky left-0 bg-gray-50 z-10">NV</th>
            {days.map(d => <th key={d} className="text-center px-1">{d.slice(-2)}</th>)}
          </tr></thead>
          <tbody>
            {employees.map(p => (
              <tr key={p.id}>
                <td className="sticky left-0 bg-white z-10 font-medium whitespace-nowrap">
                  {p.fullName}<div className="text-xs text-gray-500">{ROLE_LABEL[p.role]}</div>
                </td>
                {days.map(d => {
                  const st = getStatus(p.id, d);
                  const future = d > todayISO();
                  return (
                    <td key={d} className="text-center p-1">
                      <button onClick={() => cycle(p.id, d)} disabled={future}
                        className={`w-7 h-7 rounded text-xs font-medium ${future ? "bg-gray-50 text-gray-300" : COLOR[st]}`}
                        title={ATTENDANCE_LABEL[st]}>
                        {SHORT[st]}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 text-xs">
        <span className="badge-green">✓ Làm</span>
        <span className="badge-yellow">P Có phép</span>
        <span className="badge-red">X Không phép (trừ lương/26)</span>
        <span className="badge-blue">½ Nửa ngày</span>
      </div>
    </div>
  );
}
