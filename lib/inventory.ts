import type { ClInventory } from "@/types";

// Tồn kho thành phẩm 2 kho (Xưởng Đông Anh + Kho CL Hà Nội) dùng chung 1 shape {productId, qtyKg}.
// Mọi luồng (sản xuất, chuyển kho, bán, recover, tiêu huỷ) đều điều chỉnh qua helper này để 2 kho luôn link nhau.

export function invQty(rows: ClInventory[], productId: string): number {
  return rows.find(r => r.productId === productId)?.qtyKg ?? 0;
}

export function adjustInventory(rows: ClInventory[], productId: string, delta: number): ClInventory[] {
  const exists = rows.some(r => r.productId === productId);
  if (exists) {
    return rows.map(r => r.productId === productId ? { ...r, qtyKg: +(r.qtyKg + delta).toFixed(2) } : r);
  }
  return [...rows, { productId, qtyKg: +delta.toFixed(2) }];
}

export function totalQty(rows: ClInventory[]): number {
  return +rows.reduce((s, r) => s + r.qtyKg, 0).toFixed(2);
}
