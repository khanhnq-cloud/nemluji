import {
  PAYMENT_STATUS_LABEL, RECEIPT_STATUS_LABEL, LEAD_STATUS_LABEL, TRANSFER_STATUS_LABEL,
} from "@/lib/utils";

export function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    cash_done: "badge-green",
    da_ck: "badge-green",
    chua_ck: "badge-yellow",
    cong_no: "badge-red",
    tang: "badge-purple",
  };
  return <span className={map[status] || "badge-gray"}>{PAYMENT_STATUS_LABEL[status] || status}</span>;
}

export function ReceiptBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "badge-yellow",
    waiting_admin: "badge-yellow",
    approved: "badge-green",
    rejected: "badge-red",
    cancelled: "badge-gray",
  };
  return <span className={map[status] || "badge-gray"}>{RECEIPT_STATUS_LABEL[status] || status}</span>;
}

export function LeadBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    kem: "badge-gray",
    trung_binh: "badge-gray",
    tiem_nang: "badge-blue",
    dang_chot: "badge-yellow",
    da_chot: "badge-green",
    mat: "badge-gray",
  };
  return <span className={map[status] || "badge-gray"}>{LEAD_STATUS_LABEL[status] || status}</span>;
}

export function TransferBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "badge-yellow",
    received: "badge-green",
    cancelled: "badge-gray",
  };
  return <span className={map[status] || "badge-gray"}>{TRANSFER_STATUS_LABEL[status] || status}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    active:   { cls: "badge-green",  label: "Hoạt động" },
    inactive: { cls: "badge-gray",   label: "Ngưng" },
    pause:    { cls: "badge-yellow", label: "Tạm dừng" },
    paused:   { cls: "badge-yellow", label: "Tạm dừng" },
    lost:     { cls: "badge-gray",   label: "Mất" },
    cancelled:{ cls: "badge-gray",   label: "Đã huỷ" },
    open:     { cls: "badge-yellow", label: "Đang mở" },
    closed:   { cls: "badge-green",  label: "Đã chốt" },
    draft:    { cls: "badge-gray",   label: "Nháp" },
    approved: { cls: "badge-green",  label: "Đã duyệt" },
    locked:   { cls: "badge-blue",   label: "Đã khoá" },
  };
  const v = map[status] || { cls: "badge-gray", label: status };
  return <span className={v.cls}>{v.label}</span>;
}
