"use client";

import { useMemo, useState } from "react";
import { HandCoins, Plus, Search } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { useStore } from "@/lib/store";
import {
  EXPENSE_PAYMENT_METHOD_LABEL,
  EXPENSE_TYPE_LABEL,
  formatDate,
  formatMoney,
  newId,
  nextSequentialCode,
  todayISO,
} from "@/lib/utils";
import type { Expense, ExpensePaymentMethod, ExpenseType } from "@/types";

type ExpenseForm = {
  date: string;
  type: ExpenseType;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  payee: string;
  note: string;
};

const emptyForm = (): ExpenseForm => ({
  date: todayISO(),
  type: "other",
  amount: 0,
  paymentMethod: "cash",
  payee: "",
  note: "",
});

export default function ExpensesPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [from, setFrom] = useState(todayISO().slice(0, 8) + "01");
  const [to, setTo] = useState(todayISO());
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const canManage = can(user?.role, "manage_expenses");

  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return state.expenses
      .filter(expense => (!from || expense.date >= from) && (!to || expense.date <= to))
      .filter(expense => !type || expense.type === type)
      .filter(expense => {
        if (!query) return true;
        return [expense.code, expense.payee, expense.note, EXPENSE_TYPE_LABEL[expense.type]]
          .some(value => value?.toLocaleLowerCase("vi").includes(query));
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code));
  }, [state.expenses, from, to, type, search]);

  const todayExpenses = useMemo(
    () => state.expenses.filter(expense => expense.date === todayISO()),
    [state.expenses],
  );
  const filteredTotal = rows.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  const openCreate = () => {
    setForm(emptyForm());
    setOpen(true);
  };

  const createExpense = () => {
    if (!form.date) {
      alert("Vui lòng chọn ngày chi.");
      return;
    }
    if (!Number.isFinite(form.amount) || form.amount <= 0) {
      alert("Số tiền chi phải lớn hơn 0.");
      return;
    }
    if (!form.note.trim()) {
      alert("Vui lòng nhập nội dung chi.");
      return;
    }

    const expense: Expense = {
      id: newId(),
      code: nextSequentialCode("PC", state.expenses.map(item => item.code)),
      date: form.date,
      type: form.type,
      amount: Math.round(form.amount),
      paymentMethod: form.paymentMethod,
      payee: form.payee.trim() || undefined,
      note: form.note.trim(),
      createdBy: user?.id,
      createdAt: new Date().toISOString(),
    };
    update(current => ({ ...current, expenses: [expense, ...current.expenses] }));
    setOpen(false);
    setForm(emptyForm());
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Phiếu chi"
        subtitle="Ghi nhận và theo dõi các khoản chi theo ngày"
        actions={canManage && (
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Tạo phiếu chi
          </button>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          label="Chi hôm nay"
          value={formatMoney(todayExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0))}
          hint={`${todayExpenses.length} phiếu`}
          icon={<HandCoins className="h-4 w-4 text-red-500" />}
          tone={todayExpenses.length ? "bad" : "default"}
        />
        <StatCard label="Chi trong kỳ lọc" value={formatMoney(filteredTotal)} hint={`${rows.length} phiếu`} />
        <StatCard label="Tổng số phiếu" value={state.expenses.length} hint="Không xóa chứng từ đã ghi nhận" />
      </div>

      <div className="card p-3 grid sm:grid-cols-2 lg:grid-cols-[160px_160px_220px_minmax(220px,1fr)] gap-3 items-end">
        <label>
          <span className="label">Từ ngày</span>
          <input type="date" className="input" value={from} onChange={event => setFrom(event.target.value)} />
        </label>
        <label>
          <span className="label">Đến ngày</span>
          <input type="date" className="input" value={to} onChange={event => setTo(event.target.value)} />
        </label>
        <label>
          <span className="label">Nhóm chi</span>
          <select className="input" value={type} onChange={event => setType(event.target.value)}>
            <option value="">Tất cả nhóm chi</option>
            {Object.entries(EXPENSE_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Tìm kiếm</span>
          <span className="relative block">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input className="input pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Mã phiếu, người nhận, nội dung..." />
          </span>
        </label>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Ngày chi</th>
              <th>Nhóm chi</th>
              <th>Người nhận</th>
              <th>Hình thức</th>
              <th className="text-right">Số tiền</th>
              <th>Nội dung</th>
              <th>Người tạo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(expense => (
              <tr key={expense.id}>
                <td className="font-medium whitespace-nowrap">{expense.code}</td>
                <td className="whitespace-nowrap">{formatDate(expense.date)}</td>
                <td>{EXPENSE_TYPE_LABEL[expense.type] || expense.type}</td>
                <td>{expense.payee || "—"}</td>
                <td>{expense.paymentMethod ? EXPENSE_PAYMENT_METHOD_LABEL[expense.paymentMethod] : "—"}</td>
                <td className="text-right font-semibold text-red-600 whitespace-nowrap">{formatMoney(expense.amount)}</td>
                <td className="min-w-64">{expense.note || "—"}</td>
                <td>{state.profiles.find(profile => profile.id === expense.createdBy)?.fullName || "Hệ thống"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState title="Chưa có phiếu chi trong kỳ này" />}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Tạo phiếu chi"
        footer={(
          <>
            <button className="btn-secondary" onClick={() => setOpen(false)}>Hủy</button>
            <button className="btn-primary" onClick={createExpense}><Plus className="h-4 w-4" /> Lưu phiếu chi</button>
          </>
        )}
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <label>
            <span className="label">Ngày chi *</span>
            <input type="date" className="input" value={form.date} onChange={event => setForm(current => ({ ...current, date: event.target.value }))} />
          </label>
          <label>
            <span className="label">Nhóm chi *</span>
            <select className="input" value={form.type} onChange={event => setForm(current => ({ ...current, type: event.target.value as ExpenseType }))}>
              {Object.entries(EXPENSE_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Số tiền *</span>
            <input type="number" min="0" step="1000" className="input" value={form.amount} onChange={event => setForm(current => ({ ...current, amount: Number(event.target.value) }))} />
          </label>
          <label>
            <span className="label">Hình thức chi *</span>
            <select className="input" value={form.paymentMethod} onChange={event => setForm(current => ({ ...current, paymentMethod: event.target.value as ExpensePaymentMethod }))}>
              {Object.entries(EXPENSE_PAYMENT_METHOD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="label">Người / đơn vị nhận</span>
            <input className="input" value={form.payee} onChange={event => setForm(current => ({ ...current, payee: event.target.value }))} placeholder="Tên người nhận hoặc nhà cung cấp" />
          </label>
          <label className="sm:col-span-2">
            <span className="label">Nội dung chi *</span>
            <textarea className="input min-h-24 resize-y" value={form.note} onChange={event => setForm(current => ({ ...current, note: event.target.value }))} placeholder="Diễn giải khoản chi" />
          </label>
        </div>
      </Modal>
    </div>
  );
}
