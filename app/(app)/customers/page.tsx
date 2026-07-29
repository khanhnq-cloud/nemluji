"use client";
import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badge";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { CUSTOMER_GROUP_LABEL, B2B_GROUPS, COMPANY_ASSIGNEE, assigneeName, formatDate, formatMoney, nextSequentialCode, monthISO, newId } from "@/lib/utils";
import { isBranchDue } from "@/lib/forecast";
import { REGIONS, SOURCES } from "@/lib/mock-data";
import { Plus, ChevronDown, ChevronRight, MapPin, ArrowRight } from "lucide-react";
import type { Customer, CustomerBranch } from "@/types";

const REGION_OTHER = "__other__";

const GROUPS = Object.keys(CUSTOMER_GROUP_LABEL);

export default function CustomersPage() {
  const { state, update } = useStore();
  const { user } = useAuth();
  const month = monthISO();
  const [q, setQ] = useState("");
  const [fGroup, setFGroup] = useState("");
  const [fRegion, setFRegion] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openCust, setOpenCust] = useState(false);
  const [openBranch, setOpenBranch] = useState<string | null>(null);

  const isSale = user?.role === "sale";

  const [cf, setCf] = useState<Partial<Customer> & { branchAddress?: string; branchPhone?: string }>({ customerGroup: "quan_an_nha_hang", status: "active" });
  const [regionOther, setRegionOther] = useState(false);
  const [bf, setBf] = useState<Partial<CustomerBranch>>({ status: "active" });

  const isB2B = B2B_GROUPS.includes(cf.customerGroup || "");
  const isSupermarket = cf.customerGroup === "sieu_thi_minimart";

  const revByCustomer = useMemo(() => {
    const map: Record<string, number> = {};
    state.orders.filter(o => o.status === "active" && o.orderDate.startsWith(month)).forEach(o => {
      map[o.customerId] = (map[o.customerId] || 0) + o.revenueNet;
    });
    return map;
  }, [state.orders, month]);

  const list = useMemo(() => state.customers.filter(c => {
    if (isSale && c.assignedSaleId !== user?.id) return false;
    if (q && !`${c.fullName} ${c.customerCode}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (fGroup && c.customerGroup !== fGroup) return false;
    if (fRegion && c.region !== fRegion) return false;
    return true;
  }), [state.customers, isSale, user, q, fGroup, fRegion]);

  const toggle = (id: string) => setExpanded(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const resetForm = () => { setCf({ customerGroup: "quan_an_nha_hang", status: "active" }); setRegionOther(false); };

  const submitCustomer = () => {
    if (!cf.fullName || !cf.branchAddress) { alert("Tên khách + địa chỉ chi nhánh đầu là bắt buộc"); return; }
    if (!cf.region) { alert("Nhập khu vực"); return; }
    if (!cf.phone) { alert("Nhập SĐT liên hệ"); return; }
    if (isSupermarket && (!cf.companyName || !cf.companyAddress || !cf.companyPhone || !cf.legalRepresentative || !cf.legalRepresentativeTitle)) {
      alert("Nhập đầy đủ tên công ty, địa chỉ, điện thoại, người đại diện và chức vụ");
      return;
    }
    const custId = newId();
    const code = nextSequentialCode("KH", state.customers.map(c => c.customerCode));
    const b2b = B2B_GROUPS.includes(cf.customerGroup || "");
    const cust: Customer = {
      id: custId, customerCode: code, fullName: cf.fullName!,
      customerGroup: (cf.customerGroup as any) || "quan_an_nha_hang", region: cf.region!,
      assignedSaleId: cf.assignedSaleId || (isSale ? user!.id : COMPANY_ASSIGNEE),
      source: cf.source,
      phone: cf.phone,
      contactName: b2b ? cf.contactName : undefined,
      contactPhone: b2b ? cf.contactPhone : undefined,
      companyName: isSupermarket ? cf.companyName?.trim() : undefined,
      companyAddress: isSupermarket ? cf.companyAddress?.trim() : undefined,
      companyPhone: isSupermarket ? cf.companyPhone?.trim() : undefined,
      companyFax: isSupermarket ? cf.companyFax?.trim() || undefined : undefined,
      legalRepresentative: isSupermarket ? cf.legalRepresentative?.trim() : undefined,
      legalRepresentativeTitle: isSupermarket ? cf.legalRepresentativeTitle?.trim() : undefined,
      status: "active", note: cf.note,
    };
    const branch: CustomerBranch = {
      id: newId(), branchCode: `${code}-CN1`, customerId: custId,
      branchName: `${cf.fullName} - CN1`, address: cf.branchAddress!, phone: cf.branchPhone || cf.phone || "",
      status: "active",
    };
    update(s => ({ ...s, customers: [cust, ...s.customers], branches: [...s.branches, branch] }));
    setOpenCust(false);
    resetForm();
  };

  const submitBranch = () => {
    if (!openBranch || !bf.address) { alert("Nhập địa chỉ chi nhánh"); return; }
    const cust = state.customers.find(c => c.id === openBranch)!;
    const n = state.branches.filter(b => b.customerId === openBranch).length + 1;
    const branch: CustomerBranch = {
      id: newId(), branchCode: `${cust.customerCode}-CN${n}`, customerId: openBranch,
      branchName: bf.branchName || `${cust.fullName} - CN${n}`, address: bf.address!,
      phone: bf.phone || "", status: "active",
    };
    update(s => ({ ...s, branches: [...s.branches, branch] }));
    setOpenBranch(null);
    setBf({ status: "active" });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Khách hàng & Chi nhánh"
        subtitle="Cùng tên khác địa chỉ = chi nhánh riêng, tính doanh thu độc lập"
        actions={can(user?.role, "manage_customers") && <button className="btn-primary" onClick={() => setOpenCust(true)}><Plus className="h-4 w-4" /> Thêm khách</button>}
      />

      <div className="card p-3 flex flex-wrap gap-2">
        <input className="input w-56" placeholder="Tìm tên, mã KH…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input w-40" value={fGroup} onChange={e => setFGroup(e.target.value)}>
          <option value="">Tất cả nhóm</option>
          {GROUPS.map(g => <option key={g} value={g}>{CUSTOMER_GROUP_LABEL[g]}</option>)}
        </select>
        <select className="input w-36" value={fRegion} onChange={e => setFRegion(e.target.value)}>
          <option value="">Tất cả khu</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr>
            <th></th><th>Mã KH</th><th>Tên</th><th>Nhóm</th><th>Khu</th><th>Sale</th>
            <th className="text-right">CN</th><th className="text-right">DT tháng này</th><th>Trạng thái</th><th></th>
          </tr></thead>
          <tbody>
            {list.map(c => {
              const branches = state.branches.filter(b => b.customerId === c.id);
              const isOpen = expanded.has(c.id);
              return (
                <Fragment key={c.id}>
                  <tr>
                    <td><button onClick={() => toggle(c.id)} className="text-gray-400">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></td>
                    <td className="font-medium">
                      <Link href={`/customers/${c.id}`} className="text-brand-700 hover:underline">{c.customerCode}</Link>
                    </td>
                    <td>
                      <Link href={`/customers/${c.id}`} className="font-medium text-gray-900 hover:text-brand-700 hover:underline">{c.fullName}</Link>
                    </td>
                    <td>{CUSTOMER_GROUP_LABEL[c.customerGroup]}</td>
                    <td>{c.region}</td>
                    <td>{assigneeName(state.profiles, c.assignedSaleId)}</td>
                    <td className="text-right">{branches.length}</td>
                    <td className="text-right">{formatMoney(revByCustomer[c.id] || 0)}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="whitespace-nowrap">
                      <Link href={`/customers/${c.id}`} className="btn-ghost btn-sm" title="Xem thông tin và lịch sử lấy đơn" aria-label={`Xem khách hàng ${c.fullName}`}>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      {can(user?.role, "manage_customers") && (
                        <button className="btn-ghost btn-sm" onClick={() => { setOpenBranch(c.id); setBf({ status: "active" }); }} title="Thêm chi nhánh">
                          <MapPin className="h-3.5 w-3.5" /> + CN
                        </button>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-gray-50/60">
                      <td></td>
                      <td colSpan={9} className="text-xs text-gray-600">
                        <div>
                          Liên hệ: <b>{c.phone || "—"}</b>
                          {c.contactName && <> • Người phụ trách: <b>{c.contactName}</b>{c.contactPhone ? ` (${c.contactPhone})` : ""}</>}
                          {c.source && <> • Nguồn: {c.source}</>}
                        </div>
                        {c.customerGroup === "sieu_thi_minimart" && c.companyName && (
                          <div className="mt-1 text-gray-700">
                            Doanh nghiệp: <b>{c.companyName}</b>
                            {c.companyAddress && <> • {c.companyAddress}</>}
                            {c.companyPhone && <> • ĐT: {c.companyPhone}</>}
                            {c.companyFax && <> • Fax: {c.companyFax}</>}
                            {c.legalRepresentative && <> • Đại diện: <b>{c.legalRepresentative}</b>{c.legalRepresentativeTitle ? ` (${c.legalRepresentativeTitle})` : ""}</>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  {isOpen && branches.map(b => {
                    const due = isBranchDue(b);
                    return (
                      <tr key={b.id} className="bg-gray-50/60">
                        <td></td>
                        <td className="text-xs text-gray-500">{b.branchCode}</td>
                        <td colSpan={2}>
                          <div className="font-medium text-sm">{b.branchName}</div>
                          <div className="text-xs text-gray-500">{b.address} • {b.phone}</div>
                        </td>
                        <td colSpan={2} className="text-xs">
                          Lấy gần nhất: {formatDate(b.lastOrderDate) || "—"}<br />
                          Chu kỳ TB: {b.avgOrderGapDays ? `${b.avgOrderGapDays} ngày` : "—"}
                        </td>
                        <td colSpan={2} className="text-xs">
                          Dự kiến lấy tiếp: {formatDate(b.estNextOrderDate) || "—"}
                          {due && <span className="badge-red ml-1">Sắp/đã hết hàng</span>}
                        </td>
                        <td colSpan={2}><StatusBadge status={b.status} /></td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <EmptyState />}
      </div>

      {/* Modal thêm khách */}
      <Modal open={openCust} onClose={() => { setOpenCust(false); resetForm(); }} title="Thêm khách hàng" size="lg" footer={
        <>
          <button className="btn-secondary" onClick={() => { setOpenCust(false); resetForm(); }}>Huỷ</button>
          <button className="btn-primary" onClick={submitCustomer}>Lưu</button>
        </>
      }>
        {/* Section 1: Thông tin cơ bản */}
        <div className="text-sm font-semibold mb-2 text-gray-700">1. Thông tin cơ bản</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Tên khách *</label><input className="input" value={cf.fullName || ""} onChange={e => setCf(f => ({ ...f, fullName: e.target.value }))} /></div>
          <div>
            <label className="label">Nhóm khách *</label>
            <select className="input" value={cf.customerGroup} onChange={e => setCf(f => ({ ...f, customerGroup: e.target.value as any }))}>
              {GROUPS.map(g => <option key={g} value={g}>{CUSTOMER_GROUP_LABEL[g]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Khu vực *</label>
            <select
              className="input"
              value={regionOther ? REGION_OTHER : (cf.region || "")}
              onChange={e => {
                if (e.target.value === REGION_OTHER) { setRegionOther(true); setCf(f => ({ ...f, region: "" })); }
                else { setRegionOther(false); setCf(f => ({ ...f, region: e.target.value })); }
              }}
            >
              <option value="">— chọn quận (Hà Nội) —</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              <option value={REGION_OTHER}>Ngoại tỉnh / Khác…</option>
            </select>
            {regionOther && (
              <input className="input mt-2" placeholder="Nhập tỉnh / khu vực khác" value={cf.region || ""} onChange={e => setCf(f => ({ ...f, region: e.target.value }))} />
            )}
          </div>
          <div>
            <label className="label">Sales phụ trách</label>
            <select className="input" value={cf.assignedSaleId || ""} onChange={e => setCf(f => ({ ...f, assignedSaleId: e.target.value }))} disabled={isSale}>
              <option value="">— chọn —</option>
              {state.profiles.filter(p => p.role === "sale").map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
              <option value={COMPANY_ASSIGNEE}>Công ty</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Nguồn khách</label>
            <select className="input" value={cf.source || ""} onChange={e => setCf(f => ({ ...f, source: e.target.value }))}>
              <option value="">— chọn —</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {isSupermarket && (
          <div className="mt-4 py-4 border-y border-gray-200">
            <div className="mb-3">
              <div className="text-sm font-semibold text-gray-700">2. Thông tin doanh nghiệp</div>
              <p className="text-xs text-gray-500 mt-0.5">Hồ sơ pháp lý dành riêng cho khách hàng Siêu thị / Minimart.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="label">Tên công ty *</label>
                <input className="input" value={cf.companyName || ""} onChange={e => setCf(f => ({ ...f, companyName: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Địa chỉ *</label>
                <input className="input" value={cf.companyAddress || ""} onChange={e => setCf(f => ({ ...f, companyAddress: e.target.value }))} />
              </div>
              <div>
                <label className="label">Điện thoại *</label>
                <input type="tel" className="input" value={cf.companyPhone || ""} onChange={e => setCf(f => ({ ...f, companyPhone: e.target.value }))} />
              </div>
              <div>
                <label className="label">Fax</label>
                <input className="input" value={cf.companyFax || ""} onChange={e => setCf(f => ({ ...f, companyFax: e.target.value }))} />
              </div>
              <div>
                <label className="label">Người đại diện *</label>
                <input className="input" value={cf.legalRepresentative || ""} onChange={e => setCf(f => ({ ...f, legalRepresentative: e.target.value }))} />
              </div>
              <div>
                <label className="label">Chức vụ *</label>
                <input className="input" value={cf.legalRepresentativeTitle || ""} onChange={e => setCf(f => ({ ...f, legalRepresentativeTitle: e.target.value }))} />
              </div>
            </div>
          </div>
        )}

        {/* Thông tin liên hệ */}
        <div className="text-sm font-semibold mt-4 mb-2 text-gray-700">{isSupermarket ? "3" : "2"}. Thông tin liên hệ</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">SĐT liên hệ *</label><input type="tel" className="input" value={cf.phone || ""} onChange={e => setCf(f => ({ ...f, phone: e.target.value }))} /></div>
          {isB2B && (
            <>
              <div className="hidden sm:block" />
              <div><label className="label">Tên người phụ trách</label><input className="input" placeholder="Người liên hệ tại siêu thị / quán" value={cf.contactName || ""} onChange={e => setCf(f => ({ ...f, contactName: e.target.value }))} /></div>
              <div><label className="label">SĐT người phụ trách</label><input className="input" value={cf.contactPhone || ""} onChange={e => setCf(f => ({ ...f, contactPhone: e.target.value }))} /></div>
            </>
          )}
        </div>

        {/* Chi nhánh đầu tiên */}
        <div className="text-sm font-semibold mt-4 mb-2 text-gray-700">{isSupermarket ? "4" : "3"}. Chi nhánh đầu tiên (CN1)</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Địa chỉ chi nhánh *</label><input className="input" value={cf.branchAddress || ""} onChange={e => setCf(f => ({ ...f, branchAddress: e.target.value }))} /></div>
          <div><label className="label">SĐT chi nhánh</label><input className="input" placeholder="Để trống = dùng SĐT chính" value={cf.branchPhone || ""} onChange={e => setCf(f => ({ ...f, branchPhone: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Modal thêm chi nhánh */}
      <Modal open={!!openBranch} onClose={() => setOpenBranch(null)} title="Thêm chi nhánh" size="md" footer={
        <>
          <button className="btn-secondary" onClick={() => setOpenBranch(null)}>Huỷ</button>
          <button className="btn-primary" onClick={submitBranch}>Lưu chi nhánh</button>
        </>
      }>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className="label">Tên chi nhánh</label><input className="input" placeholder="VD: Khánh - Văn Cao" value={bf.branchName || ""} onChange={e => setBf(f => ({ ...f, branchName: e.target.value }))} /></div>
          <div className="sm:col-span-2"><label className="label">Địa chỉ *</label><input className="input" value={bf.address || ""} onChange={e => setBf(f => ({ ...f, address: e.target.value }))} /></div>
          <div><label className="label">SĐT</label><input className="input" value={bf.phone || ""} onChange={e => setBf(f => ({ ...f, phone: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}
