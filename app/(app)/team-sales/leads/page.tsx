"use client";
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { LeadBadge } from "@/components/Badge";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  CUSTOMER_GROUP_LABEL, LEAD_STATUS_LABEL, VISIT_TYPE_LABEL,
  formatDate, formatMoney, nextSequentialCode, newId, todayISO,
} from "@/lib/utils";
import { REGIONS } from "@/lib/mock-data";
import { Plus, ArrowRightCircle, MessageSquarePlus } from "lucide-react";
import type { Lead, LeadVisit, Customer, CustomerBranch } from "@/types";

const GROUPS = Object.keys(CUSTOMER_GROUP_LABEL);

export default function LeadsPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const isSale = user?.role === "sale";
  const [fStatus, setFStatus] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const blank = (): Partial<Lead> => ({
    saleId: isSale ? user!.id : "",
    region: REGIONS[0], customerGroup: "quan_an_nha_hang", leadStatus: "kem",
    createdDate: todayISO(), addresses: [""],
  });
  const [lf, setLf] = useState<Partial<Lead>>(blank());

  const leads = useMemo(() => state.leads
    .filter(l => (!isSale || l.saleId === user?.id) && (!fStatus || l.leadStatus === fStatus))
    .sort((a, b) => b.createdDate.localeCompare(a.createdDate)), [state.leads, isSale, user, fStatus]);

  const detail = state.leads.find(l => l.id === detailId);

  const submitLead = () => {
    if (!lf.customerName || !lf.phone || !lf.saleId) { alert("Tên khách, SĐT, sale là bắt buộc"); return; }
    const lead: Lead = {
      id: newId(), leadCode: nextSequentialCode("LD", state.leads.map(l => l.leadCode)), saleId: lf.saleId!,
      customerName: lf.customerName!, region: lf.region || REGIONS[0],
      customerGroup: (lf.customerGroup as any) || "quan_an", phone: lf.phone!,
      addresses: (lf.addresses || []).filter(Boolean),
      offeredPrice: lf.offeredPrice, offeredGiftProgram: lf.offeredGiftProgram,
      offeredDiscountProgram: lf.offeredDiscountProgram, expectedRevenue: lf.expectedRevenue,
      sampleQtyTotal: 0, sampleCostTotal: 0, leadStatus: (lf.leadStatus as any) || "kem",
      createdDate: lf.createdDate || todayISO(), visits: [],
    };
    update(s => ({ ...s, leads: [lead, ...s.leads] }));
    setOpenNew(false); setLf(blank());
  };

  const setStatus = (id: string, status: Lead["leadStatus"]) => {
    update(s => ({ ...s, leads: s.leads.map(l => l.id === id ? { ...l, leadStatus: status } : l) }));
  };

  const convertToCustomer = (l: Lead) => {
    if (l.convertedCustomerId) { alert("Lead đã chuyển khách"); return; }
    if (!confirm(`Tạo khách hàng từ lead "${l.customerName}"?`)) return;
    const custId = newId();
    const code = nextSequentialCode("KH", state.customers.map(c => c.customerCode));
    const cust: Customer = {
      id: custId, customerCode: code, fullName: l.customerName,
      customerGroup: l.customerGroup, region: l.region, assignedSaleId: l.saleId,
      source: "Sale thị trường", status: "active", note: `Từ lead ${l.leadCode}`,
    };
    const branch: CustomerBranch = {
      id: newId(), branchCode: `${code}-CN1`, customerId: custId,
      branchName: `${l.customerName} - CN1`, address: l.addresses[0] || "", phone: l.phone, status: "active",
    };
    update(s => ({
      ...s,
      customers: [cust, ...s.customers],
      branches: [...s.branches, branch],
      leads: s.leads.map(x => x.id === l.id ? { ...x, leadStatus: "da_chot", convertedCustomerId: custId, convertedAt: todayISO() } : x),
    }));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lead / Khách tiềm năng"
        subtitle={`${leads.length} lead`}
        actions={can(user?.role, "manage_leads") && <button className="btn-primary" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4" /> Thêm lead</button>}
      />

      <div className="card p-3 flex gap-2">
        <select className="input w-44" value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(LEAD_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr>
            <th>Mã</th><th>Ngày</th><th>Sale</th><th>Khách</th><th>Khu</th><th>Nhóm</th>
            <th className="text-right">Hàng mẫu</th><th className="text-right">Cost mẫu</th><th>Visit</th><th>Trạng thái</th><th></th>
          </tr></thead>
          <tbody>
            {leads.map(l => {
              const sale = state.profiles.find(p => p.id === l.saleId);
              const lastVisit = l.visits[l.visits.length - 1];
              return (
                <tr key={l.id} className="cursor-pointer" onClick={() => setDetailId(l.id)}>
                  <td className="font-medium">{l.leadCode}</td>
                  <td>{formatDate(l.createdDate)}</td>
                  <td>{sale?.fullName || "—"}</td>
                  <td><div>{l.customerName}</div><div className="text-xs text-gray-500">{l.phone}</div></td>
                  <td>{l.region}</td>
                  <td>{CUSTOMER_GROUP_LABEL[l.customerGroup]}</td>
                  <td className="text-right">{l.sampleQtyTotal}</td>
                  <td className="text-right">{formatMoney(l.sampleCostTotal)}</td>
                  <td>{l.visits.length} lần{lastVisit?.nextActionDate && <div className="text-xs text-amber-600">Hẹn: {formatDate(lastVisit.nextActionDate)}</div>}</td>
                  <td><LeadBadge status={l.leadStatus} /></td>
                  <td onClick={e => e.stopPropagation()}>
                    {l.leadStatus === "da_chot" && !l.convertedCustomerId && can(user?.role, "manage_leads") && (
                      <button className="btn-secondary btn-sm" onClick={() => convertToCustomer(l)}><ArrowRightCircle className="h-3.5 w-3.5" /> Tạo KH</button>
                    )}
                    {l.convertedCustomerId && <span className="badge-green">Đã chuyển KH</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {leads.length === 0 && <EmptyState />}
      </div>

      {/* Modal new lead */}
      <Modal open={openNew} onClose={() => setOpenNew(false)} title="Thêm lead" size="lg" footer={
        <>
          <button className="btn-secondary" onClick={() => setOpenNew(false)}>Huỷ</button>
          <button className="btn-primary" onClick={submitLead}>Lưu lead</button>
        </>
      }>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Tên khách *</label><input className="input" value={lf.customerName || ""} onChange={e => setLf(f => ({ ...f, customerName: e.target.value }))} /></div>
          <div><label className="label">SĐT *</label><input className="input" value={lf.phone || ""} onChange={e => setLf(f => ({ ...f, phone: e.target.value }))} /></div>
          <div>
            <label className="label">Sale *</label>
            <select className="input" value={lf.saleId || ""} onChange={e => setLf(f => ({ ...f, saleId: e.target.value }))} disabled={isSale}>
              <option value="">— chọn —</option>
              {state.profiles.filter(p => p.role === "sale").map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Khu vực</label>
            <select className="input" value={lf.region || ""} onChange={e => setLf(f => ({ ...f, region: e.target.value }))}>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nhóm khách</label>
            <select className="input" value={lf.customerGroup || ""} onChange={e => setLf(f => ({ ...f, customerGroup: e.target.value as any }))}>
              {GROUPS.map(g => <option key={g} value={g}>{CUSTOMER_GROUP_LABEL[g]}</option>)}
            </select>
          </div>
          <div><label className="label">Địa chỉ</label><input className="input" value={lf.addresses?.[0] || ""} onChange={e => setLf(f => ({ ...f, addresses: [e.target.value] }))} /></div>
          <div><label className="label">Giá chào</label><input type="number" className="input" value={lf.offeredPrice || ""} onChange={e => setLf(f => ({ ...f, offeredPrice: Number(e.target.value) }))} /></div>
          <div><label className="label">Doanh thu kỳ vọng</label><input type="number" className="input" value={lf.expectedRevenue || ""} onChange={e => setLf(f => ({ ...f, expectedRevenue: Number(e.target.value) }))} /></div>
          <div><label className="label">CT tặng</label><input className="input" value={lf.offeredGiftProgram || ""} onChange={e => setLf(f => ({ ...f, offeredGiftProgram: e.target.value }))} /></div>
          <div><label className="label">CT chiết khấu</label><input className="input" value={lf.offeredDiscountProgram || ""} onChange={e => setLf(f => ({ ...f, offeredDiscountProgram: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Detail + visits */}
      <LeadDetailModal lead={detail || null} onClose={() => setDetailId(null)} onSetStatus={setStatus} />
    </div>
  );
}

function LeadDetailModal({ lead, onClose, onSetStatus }: { lead: Lead | null; onClose: () => void; onSetStatus: (id: string, s: Lead["leadStatus"]) => void }) {
  const { state, update } = useStore();
  const { user } = useAuth();
  const [vf, setVf] = useState<Partial<LeadVisit> & { sampleProductId?: string; sampleQty?: number }>({
    visitDate: todayISO(), visitType: "gap",
  });

  if (!lead) return null;

  const addVisit = () => {
    if (!vf.content) { alert("Nhập nội dung visit"); return; }
    const newSample = vf.sampleProductId && vf.sampleQty ? [{ productId: vf.sampleProductId, qty: Number(vf.sampleQty) }] : [];
    const visit: LeadVisit = {
      id: newId(), leadId: lead.id, visitDate: vf.visitDate || todayISO(),
      visitType: (vf.visitType as any) || "gap", content: vf.content!,
      nextActionDate: vf.nextActionDate, nextActionNote: vf.nextActionNote,
      newSample, createdBy: user!.id,
    };
    // cộng dồn sample (Rule 8.4.3)
    let addQty = 0, addCost = 0;
    newSample.forEach(s => {
      const prod = state.products.find(p => p.id === s.productId);
      addQty += s.qty; addCost += s.qty * (prod?.fixCost || 0);
    });
    update(st => ({
      ...st,
      leads: st.leads.map(l => l.id === lead.id ? {
        ...l, visits: [...l.visits, visit],
        sampleQtyTotal: l.sampleQtyTotal + addQty,
        sampleCostTotal: l.sampleCostTotal + addCost,
      } : l),
    }));
    setVf({ visitDate: todayISO(), visitType: "gap" });
  };

  return (
    <Modal open={!!lead} onClose={onClose} title={`${lead.leadCode} — ${lead.customerName}`} size="lg" footer={<button className="btn-secondary" onClick={onClose}>Đóng</button>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-500">Trạng thái:</span>
          {(["kem", "trung_binh", "tiem_nang", "dang_chot", "da_chot", "mat"] as const).map(s => (
            <button key={s} onClick={() => onSetStatus(lead.id, s)}
              className={`badge ${lead.leadStatus === s ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600"}`}>
              {LEAD_STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <Info label="Tổng hàng mẫu" value={`${lead.sampleQtyTotal}`} />
          <Info label="Tổng cost mẫu" value={formatMoney(lead.sampleCostTotal)} />
          <Info label="Giá chào" value={lead.offeredPrice ? formatMoney(lead.offeredPrice) : "—"} />
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">Lịch sử visit ({lead.visits.length})</div>
          <div className="space-y-2">
            {lead.visits.length === 0 && <div className="text-sm text-gray-400">Chưa có visit</div>}
            {[...lead.visits].reverse().map(v => (
              <div key={v.id} className="border border-gray-200 rounded-md p-2.5">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{formatDate(v.visitDate)} • {VISIT_TYPE_LABEL[v.visitType]}</span>
                  {v.nextActionDate && <span className="text-amber-600">Hẹn: {formatDate(v.nextActionDate)}</span>}
                </div>
                <div className="text-sm mt-1">{v.content}</div>
                {v.newSample.length > 0 && (
                  <div className="text-xs text-purple-600 mt-1">
                    Phát thử: {v.newSample.map(s => `${state.products.find(p => p.id === s.productId)?.name} ${s.qty}`).join(", ")}
                  </div>
                )}
                {v.nextActionNote && <div className="text-xs text-gray-500 mt-1">→ {v.nextActionNote}</div>}
              </div>
            ))}
          </div>
        </div>

        {can(user?.role, "manage_leads") && (
          <div className="border-t border-gray-200 pt-3">
            <div className="text-sm font-semibold mb-2 flex items-center gap-1"><MessageSquarePlus className="h-4 w-4" /> Thêm visit</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="label">Ngày</label><input type="date" className="input" value={vf.visitDate} onChange={e => setVf(f => ({ ...f, visitDate: e.target.value }))} /></div>
              <div>
                <label className="label">Hình thức</label>
                <select className="input" value={vf.visitType} onChange={e => setVf(f => ({ ...f, visitType: e.target.value as any }))}>
                  {Object.entries(VISIT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2"><label className="label">Nội dung *</label><textarea className="input" rows={2} value={vf.content || ""} onChange={e => setVf(f => ({ ...f, content: e.target.value }))} /></div>
              <div>
                <label className="label">Phát thử thêm — sản phẩm</label>
                <select className="input" value={vf.sampleProductId || ""} onChange={e => setVf(f => ({ ...f, sampleProductId: e.target.value }))}>
                  <option value="">— không —</option>
                  {state.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label className="label">SL phát thử</label><input type="number" step="0.1" className="input" value={vf.sampleQty || ""} onChange={e => setVf(f => ({ ...f, sampleQty: Number(e.target.value) }))} /></div>
              <div><label className="label">Hẹn lần sau</label><input type="date" className="input" value={vf.nextActionDate || ""} onChange={e => setVf(f => ({ ...f, nextActionDate: e.target.value }))} /></div>
              <div><label className="label">Ghi chú hành động</label><input className="input" value={vf.nextActionNote || ""} onChange={e => setVf(f => ({ ...f, nextActionNote: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end mt-3"><button className="btn-primary" onClick={addVisit}>Lưu visit</button></div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="border border-gray-200 rounded-md p-2.5"><div className="text-xs text-gray-500">{label}</div><div className="font-semibold mt-0.5">{value}</div></div>;
}
