"use client";
import { useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { formatDate, daysBetween, todayISO, assigneeName } from "@/lib/utils";
import { isBranchDue } from "@/lib/forecast";
import { MessageSquareText } from "lucide-react";

export default function ForecastPage() {
  const { state } = useStore();
  const { user } = useAuth();
  const today = todayISO();
  const isSale = user?.role === "sale";

  const rows = useMemo(() => {
    return state.branches
      .map(b => {
        const cust = state.customers.find(c => c.id === b.customerId);
        return { b, cust };
      })
      .filter(({ cust }) => cust && (!isSale || cust.assignedSaleId === user?.id))
      .sort((a, b) => (a.b.estNextOrderDate || "9999").localeCompare(b.b.estNextOrderDate || "9999"));
  }, [state.branches, state.customers, isSale, user]);

  const remind = (name: string, late: number) =>
    `Anh/chị ${name}, đã ${late} ngày mình chưa lấy nem ạ, em chuẩn bị giúp đợt mới nhé?`;

  return (
    <div className="space-y-4">
      <PageHeader title="Dự báo lịch order" subtitle="est_next = lần lấy gần nhất + trung bình khoảng cách đơn (3 tháng)" />
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr>
            <th>Khách / Chi nhánh</th><th>Sale</th><th>Lấy gần nhất</th><th>Chu kỳ TB</th>
            <th>Dự kiến lấy tiếp</th><th>Tình trạng</th><th></th>
          </tr></thead>
          <tbody>
            {rows.map(({ b, cust }) => {
              const due = isBranchDue(b, today);
              const late = b.estNextOrderDate ? daysBetween(b.estNextOrderDate, today) : 0;
              return (
                <tr key={b.id} className={due ? "bg-red-50/30" : ""}>
                  <td>
                    <div className="font-medium">{cust?.fullName}</div>
                    <div className="text-xs text-gray-500">{b.branchName} • {b.phone}</div>
                  </td>
                  <td>{assigneeName(state.profiles, cust?.assignedSaleId)}</td>
                  <td>{formatDate(b.lastOrderDate) || "—"}</td>
                  <td>{b.avgOrderGapDays ? `${b.avgOrderGapDays} ngày` : "—"}</td>
                  <td>{formatDate(b.estNextOrderDate) || "—"}</td>
                  <td>{due ? <span className="badge-red">Quá hạn {late} ngày</span> : <span className="badge-green">Đúng lịch</span>}</td>
                  <td>
                    {due && (
                      <button className="btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(remind(cust!.fullName, late)).then(() => alert("Đã copy tin nhắc"))}>
                        <MessageSquareText className="h-3.5 w-3.5" /> Soạn tin
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState />}
      </div>
    </div>
  );
}
