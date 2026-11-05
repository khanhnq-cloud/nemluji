import type { Customer } from "@/types";

const normalizePhone = (s?: string) => (s || "").replace(/\D/g, "");
const normalizeName = (s?: string) => (s || "").trim().toLocaleLowerCase("vi").replace(/\s+/g, " ");

// Kiểm tra trùng trước khi tạo khách (dùng chung cho /customers, tạo nhanh ở đơn hàng, chuyển lead).
// Trùng SĐT → chặn. Trùng tên, khác SĐT → hỏi lại (có thể là 2 khách cùng tên).
export function confirmNewCustomer(customers: Customer[], input: { fullName?: string; phone?: string }): boolean {
  const phone = normalizePhone(input.phone);
  const samePhone = phone ? customers.find(c => normalizePhone(c.phone) === phone) : undefined;
  if (samePhone) {
    alert(`SĐT này đã thuộc khách ${samePhone.customerCode} — ${samePhone.fullName}. Dùng khách có sẵn hoặc thêm chi nhánh.`);
    return false;
  }
  const name = normalizeName(input.fullName);
  const sameName = customers.find(c => normalizeName(c.fullName) === name);
  if (sameName) {
    return confirm(`Đã có khách cùng tên: ${sameName.customerCode} — ${sameName.fullName}. Vẫn tạo khách mới?`);
  }
  return true;
}
