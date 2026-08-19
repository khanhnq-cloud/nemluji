"use client";
import { useState } from "react";
import Modal from "@/components/Modal";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { EXPENSE_PAYMENT_METHOD_LABEL, EXPENSE_TYPE_LABEL, newId, nextSequentialCode, todayISO } from "@/lib/utils";
import { Plus } from "lucide-react";
import type { Expense, ExpensePaymentMethod, ExpenseType } from "@/types";

type ExpenseForm = {
  date: string; type: ExpenseType; amount: number;
  paymentMethod: ExpensePaymentMethod; payee: string; note: string;
};
const emptyForm = (): ExpenseForm => ({
  date: todayISO(), type: "other", amount: 0, paymentMethod: "cash", payee: "", note: "",
});

export default function ExpenseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { update } = useStore();
  const { user } = useAuth();
  const [form, setForm] = useState<ExpenseForm>(emptyForm);

  const save = () => {
    if (!form.date) { alert("Vui lòng chọn ngày chi."); return; }
    if (!Number.isFinite(form.amount) || form.amount <= 0) { alert("Số tiền chi phải lớn hơn 0."); return; }
    if (!form.note.trim()) { alert("Vui lòng nhập nội dung chi."); return; }
    update(current => {
      const expense: Expense = {
        id: newId(),
        code: nextSequentialCode("PC", current.expenses.map(item => item.code)),
        date: form.date, type: form.type, amount: Math.round(form.amount),
        paymentMethod: form.paymentMethod, payee: form.payee.trim() || undefined,
        note: form.note.trim(), createdBy: user?.id, createdAt: new Date().toISOString(),
      };
      return { ...current, expenses: [expense, ...current.expenses] };
    });
    setForm(emptyForm());
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Tạo phiếu chi" footer={(
      <>
        <button className="btn-secondary" onClick={onClose}>Hủy</button>
        <button className="btn-primary" onClick={save}><Plus className="h-4 w-4" /> Lưu phiếu chi</button>
      </>
    )}>
      <div className="grid sm:grid-cols-2 gap-4">
        <label>
          <span className="label">Ngày chi *</span>
          <input type="date" className="input" value={form.date} onChange={e => setForm(c => ({ ...c, date: e.target.value }))} />
        </label>
        <label>
          <span className="label">Nhóm chi *</span>
          <select className="input" value={form.type} onChange={e => setForm(c => ({ ...c, type: e.target.value as ExpenseType }))}>
            {Object.entries(EXPENSE_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Số tiền *</span>
          <input type="number" min="0" step="1000" className="input" value={form.amount} onChange={e => setForm(c => ({ ...c, amount: Number(e.target.value) }))} />
        </label>
        <label>
          <span className="label">Hình thức chi *</span>
          <select className="input" value={form.paymentMethod} onChange={e => setForm(c => ({ ...c, paymentMethod: e.target.value as ExpensePaymentMethod }))}>
            {Object.entries(EXPENSE_PAYMENT_METHOD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="label">Người / đơn vị nhận</span>
          <input className="input" value={form.payee} onChange={e => setForm(c => ({ ...c, payee: e.target.value }))} placeholder="Tên người nhận hoặc nhà cung cấp" />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Nội dung chi *</span>
          <textarea className="input min-h-24 resize-y" value={form.note} onChange={e => setForm(c => ({ ...c, note: e.target.value }))} placeholder="Diễn giải khoản chi" />
        </label>
      </div>
    </Modal>
  );
}
