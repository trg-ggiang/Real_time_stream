import { useState, type FormEvent } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { PencilSimple } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import "../departments.css";
import "../members.css";
import { Link, useSearchParams } from "react-router-dom";
import { useClub } from "../workspace-context";
import { useWorkspaceMutation } from "../use-workspace-mutation";
import {
  workspaceRequest,
  type Department,
  type Member,
  type WorkspaceList,
} from "../services/workspace-api";
import { usePersonalQuery } from "../../personal/use-personal-query";
import { PersonalState } from "../../personal/components/PersonalState";
import { ContentImage } from "../../discovery/components/PublicContent";
import { AddMemberPanel } from "./AddMemberPanel";
export function MembersPage() {
  const { token, clubId, membership, reload } = useClub();
  const [params, setParams] = useSearchParams();
  const departmentFilter = params.get("department") || "";
  const n = Number(params.get("page") || 1),
    page = Number.isInteger(n) ? Math.max(1, Math.min(10000, n)) : 1;
  const state = usePersonalQuery<WorkspaceList<Member>>(
    token,
    `workspace/${clubId}/members?page=${page}&limit=24${departmentFilter ? `&department_id=${encodeURIComponent(departmentFilter)}` : ""}`,
  );
  const depts = usePersonalQuery<WorkspaceList<Department>>(
    token,
    `workspace/${clubId}/departments`,
  );
  const [message, setMessage] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [departmentFilterUi, setDepartmentFilterUi] = useState(departmentFilter);
  const [roleFilter, setRoleFilter] = useState("all");
  const chair = membership.role === "chairperson";
  const selectedDepartment = depts.data?.items.find(d => d.department_id === departmentFilter);
  const members = state.data?.items || [];
  const filteredMembers = members.filter(member =>
    member.users.display_name.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi"))
    && (!departmentFilterUi || member.department_id === departmentFilterUi)
    && (roleFilter === "all" || member.role === roleFilter),
  );
  return (
    <>
      <div className={`cw-heading${chair ? " cw-member-heading" : ""}`}>
        <div>
          <h1>{chair ? "Quản lý thành viên" : selectedDepartment ? `Thành viên · ${selectedDepartment.name}` : "Những người cùng CLB"}</h1>
          <p>
            {chair ? (selectedDepartment ? `${selectedDepartment.name} · ${state.data?.total ?? "…"} thành viên` : "CLB của bạn · Quản lý thành viên và phân ban") : "Mỗi thành viên thuộc một ban. Vai trò chủ nhiệm chỉ có hiệu lực trong CLB này."}
          </p>
        </div>
        {chair ? (!selectedDepartment || selectedDepartment.status === "active") && <button type="button" className="cw-primary cw-member-add-toggle" onClick={() => setShowAdd(value => !value)}><Plus size={16} aria-hidden="true" />{showAdd ? "Đóng" : "Thêm thành viên"}</button> : <span className="cw-count">{state.data?.total ?? "…"} thành viên</span>}
      </div>
      {chair && showAdd && (!selectedDepartment || selectedDepartment.status === "active") && (
        <AddMemberPanel departments={depts.data?.items || []} initialDepartment={departmentFilter}
          onCancel={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); setMessage("Đã thêm tài khoản vào CLB."); state.retry(); reload(); }} />
      )}
      {chair && selectedDepartment?.status === "inactive" && <p className="cw-dp-members-context">Ban đã ngừng hoạt động; không thể thêm thành viên mới vào ban này.</p>}
      {message && chair && <p role="status" className="cw-success cw-member-success">{message}</p>}
      {depts.error && <PersonalState {...depts} />}
      {selectedDepartment && <p className="cw-dp-members-context"><Link to={`/workspace/${clubId}/departments`}>← Quay lại Các ban</Link><span>Đang xem thành viên của {selectedDepartment.name}</span></p>}
      {chair && <div className="cw-member-filters" aria-label="Lọc thành viên">
        <label className="cw-member-search"><MagnifyingGlass size={17} aria-hidden="true" /><span className="cw-dp-sr-only">Tìm theo tên</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm theo tên" /></label>
        <label><span className="cw-dp-sr-only">Lọc theo ban</span><select value={departmentFilterUi} onChange={event => setDepartmentFilterUi(event.target.value)}><option value="">Tất cả các ban</option>{depts.data?.items.map(d => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}</select></label>
        <label><span className="cw-dp-sr-only">Lọc theo vai trò</span><select value={roleFilter} onChange={event => setRoleFilter(event.target.value)}><option value="all">Tất cả vai trò</option><option value="chairperson">Chủ nhiệm</option><option value="head">Trưởng ban</option><option value="member">Thành viên</option></select></label>
        <label><span className="cw-dp-sr-only">Lọc theo trạng thái</span><select value="active" disabled aria-label="Trạng thái thành viên"><option value="active">Đang hoạt động</option></select></label>
      </div>}
      <section className={`cw-member-table-wrap${chair ? "" : " cw-member-directory"}`} aria-label="Danh sách thành viên">
        {state.data?.items.length ? <>
          <table className="cw-member-table"><caption className="cw-dp-sr-only">Thành viên trong CLB</caption><thead><tr><th scope="col">Họ và tên</th><th scope="col">Ban</th><th scope="col">Vai trò</th><th scope="col">Ngày tham gia</th><th scope="col">Trạng thái</th>{chair && <th scope="col" className="cw-member-action-heading">Thao tác</th>}</tr></thead><tbody>
            {(chair ? filteredMembers : members).map(member => <MemberTableRow key={member.membership_id} member={member} departments={depts.data?.items || []} refresh={() => { state.retry(); reload(); }} />)}
          </tbody></table>
          {chair && !filteredMembers.length && <p className="cw-member-filter-empty">Không tìm thấy thành viên phù hợp.</p>}
        </> : <PersonalState {...state} empty="Chưa có thành viên để hiển thị." />}
      </section>
      <nav className="cw-pagination" aria-label="Phân trang thành viên">
        <button
          disabled={page === 1 || state.loading}
          onClick={() => setParams(previous => { previous.set("page", String(page - 1)); return previous; })}
        >
          ← Trước
        </button>
        <span>Trang {page}</span>
        <button
          disabled={!state.data?.hasMore || state.loading}
          onClick={() => setParams(previous => { previous.set("page", String(page + 1)); return previous; })}
        >
          Sau →
        </button>
      </nav>
    </>
  );
}
function MemberTableRow({ member, departments, refresh }: {
  member: Member;
  departments: Department[];
  refresh: () => void;
}) {
  const { token, clubId, membership } = useClub();
  const chair = membership.role === "chairperson";
  const mutation = useWorkspaceMutation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [department, setDepartment] = useState(member.department_id);
  async function action(kind: "move" | "remove" | "transfer") {
    if (!chair) return;
    if (kind !== "move" && !window.confirm(kind === "remove"
      ? `Gỡ ${member.users.display_name} khỏi CLB?`
      : `Chuyển quyền chủ nhiệm cho ${member.users.display_name}? Bạn sẽ trở thành thành viên.`)) return;
    const path = kind === "transfer" ? "transfer-chair" : `members/${member.membership_id}/${kind === "move" ? "department" : "remove"}`;
    const body = kind === "move" ? { department_id: department } : kind === "transfer" ? { membership_id: member.membership_id } : undefined;
    const result = await mutation.run(signal => workspaceRequest(token, clubId, path, {
      method: kind === "move" ? "PATCH" : "POST", signal,
      ...(body && { body: JSON.stringify(body) }),
    }));
    if (result) { setMenuOpen(false); setMoveOpen(false); refresh(); }
  }
  const joined = new Date(member.joined_at);
  const joinedLabel = Number.isNaN(joined.valueOf()) ? "—" : joined.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  return <>
    <tr className="cw-member-table-row">
      <td data-label="Họ và tên"><div className="cw-member-identity"><ContentImage src={member.users.avatar_url} alt="" className="cw-member-table-photo" fallbackText={member.users.display_name.trim().split(/\s+/).slice(-2).map(part => part[0]).join("").toLocaleUpperCase("vi-VN") || "TV"} /><strong>{member.users.display_name}</strong></div></td>
      <td data-label="Ban">{member.club_departments.name}</td>
      <td data-label="Vai trò">{member.role === "chairperson" ? "Chủ nhiệm" : member.role === "head" ? "Trưởng ban" : "Thành viên"}</td>
      <td data-label="Ngày tham gia">{joinedLabel}</td>
      <td data-label="Trạng thái"><span className="cw-member-status"><i aria-hidden="true" />Đang hoạt động</span></td>
      {chair && <td data-label="Thao tác" className="cw-member-action-cell">
        {member.role !== "chairperson" && <div className="cw-member-menu-wrap">
          <button type="button" className="cw-member-menu-trigger" aria-label={`Thao tác với ${member.users.display_name}`} aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>···</button>
          {menuOpen && <div className="cw-member-menu">
            <button type="button" onClick={() => { setDetailsOpen(value => !value); setMoveOpen(false); setMenuOpen(false); }}>Xem chi tiết</button>
            <button type="button" onClick={() => { setMoveOpen(value => !value); setDetailsOpen(false); setMenuOpen(false); }}>Chuyển ban</button>
            <button type="button" onClick={() => action("transfer")} disabled={mutation.busy}>Chuyển chủ nhiệm</button>
            <button type="button" className="is-danger" onClick={() => action("remove")} disabled={mutation.busy}>Xóa khỏi CLB</button>
          </div>}
        </div>}
      </td>}
    </tr>
    {chair && (detailsOpen || moveOpen || mutation.error) && <tr className="cw-member-extra-row"><td colSpan={6}>
      {detailsOpen && <p><strong>{member.users.display_name}</strong> · {member.role === "chairperson" ? "Chủ nhiệm" : member.role === "head" ? "Trưởng ban" : "Thành viên"} của {member.club_departments.name}, tham gia {joinedLabel}.</p>}
      {moveOpen && <div className="cw-member-move"><label>Chuyển sang ban<select value={department} onChange={event => setDepartment(event.target.value)} disabled={mutation.busy}>{departments.filter(d => d.status === "active").map(d => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}</select></label><button type="button" className="cw-primary" onClick={() => action("move")} disabled={mutation.busy || department === member.department_id}>{mutation.busy ? "Đang lưu…" : "Lưu ban"}</button></div>}
      {mutation.error && <p role="alert" className="cw-error">{mutation.error}</p>}
    </td></tr>}
  </>;
}

export function DepartmentsPage() {
  const { token, clubId, membership } = useClub();
  const result = usePersonalQuery<WorkspaceList<Department>>(
    token,
    `workspace/${clubId}/departments`,
  );
  const [editing, setEditing] = useState<Department | null>(null);
  const [show, setShow] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [notice, setNotice] = useState("");
  const chair = membership.role === "chairperson";
  const normalize = (value: string) => value.toLocaleLowerCase("vi").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d");
  const items = result.data?.items || [];
  const filtered = items.filter(d => (status === "all" || d.status === status) && normalize(d.name).includes(normalize(search.trim())));
  function clearFilters() { setSearch(""); setStatus("all"); }
  if (chair && show) return <div className="cw-departments"><DepartmentForm
    key={editing?.department_id || "new"}
    department={editing}
    close={() => setShow(false)}
    done={() => {
      setShow(false); clearFilters();
      setNotice(editing ? "Đã cập nhật ban." : "Đã tạo ban thành công.");
      result.retry();
    }}
  /></div>;
  return (
    <div className="cw-departments">
      <div className="cw-heading cw-dp-heading">
        <div>
          <h1>Các ban</h1>
          <p>Theo dõi cơ cấu và các ban trong CLB.</p>
        </div>
        {chair && (
          <button
            type="button"
            className="cw-primary"
            onClick={() => {
              setEditing(null);
              setNotice("");
              setShow(true);
            }}
          >
            <Plus size={18} aria-hidden="true" />Tạo ban
          </button>
        )}
      </div>
      {notice && <p className="cw-dp-success" role="status">{notice}</p>}
      <div className="cw-dp-toolbar">
        <label className="cw-dp-search"><MagnifyingGlass size={19} aria-hidden="true" /><span className="cw-dp-sr-only">Tìm theo tên ban</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo tên ban" maxLength={160} /></label>
        <label className="cw-dp-filter"><span className="cw-dp-sr-only">Lọc trạng thái ban</span><select value={status} onChange={e => setStatus(e.target.value)}><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option></select></label>
      </div>
      {result.data && <p className="cw-dp-count" role="status">{filtered.length} / {items.length} ban{search.trim() && ` cho “${search.trim()}”`}</p>}
      {!result.data ? <section className="cw-panel"><PersonalState {...result} /></section> : filtered.length ? <div className="cw-dp-table-wrap">
        <table className="cw-dp-table"><caption className="cw-dp-sr-only">Danh sách các ban trong CLB</caption><thead><tr><th scope="col">Tên ban</th><th scope="col">Hiển thị</th><th scope="col">Trạng thái</th>{chair && <th scope="col" className="cw-dp-action-cell">Thao tác</th>}</tr></thead>
          <tbody>{filtered.map(d => <tr key={d.department_id}>
            <th scope="row" className="cw-dp-name"><div><strong>{d.name}</strong>{d.is_management && <span className="cw-dp-management">Ban quản lý</span>}</div><p>{d.description || "Chưa có mô tả."}</p></th>
            <td data-label="Hiển thị"><span title={d.is_private ? "Ban riêng tư trong CLB" : "Hiển thị với các thành viên trong CLB"}>{d.is_private ? "Riêng tư" : "Công khai"}</span></td>
            <td data-label="Trạng thái"><span className={`cw-dp-status ${d.status}`}>{d.status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"}</span></td>
            {chair && <td className="cw-dp-action-cell"><button type="button" className="cw-dp-edit" aria-label={`Chỉnh sửa ${d.name}`} onClick={() => { setEditing(d); setShow(true); }}><PencilSimple size={16} aria-hidden="true" />Chỉnh sửa</button></td>}
          </tr>)}</tbody>
        </table>
      </div> : <section className="cw-panel cw-dp-empty"><h2>{items.length ? "Không có ban phù hợp" : "CLB chưa có ban nào"}</h2><p>{items.length ? "Thử tên khác hoặc chọn trạng thái khác để tìm ban." : "Các ban của CLB sẽ xuất hiện tại đây sau khi được tạo."}</p>{items.length > 0 && <button type="button" onClick={clearFilters}>Xóa bộ lọc</button>}</section>}
    </div>
  );
}
function DepartmentForm({
  department,
  close,
  done,
}: {
  department: Department | null;
  close: () => void;
  done: () => void;
}) {
  const { token, clubId } = useClub();
  const mutation = useWorkspaceMutation();
  const [name, setName] = useState(department?.name || "");
  const [description, setDescription] = useState(department?.description || "");
  const [privateBan, setPrivate] = useState(department?.is_private || false);
  const [management, setManagement] = useState(department?.is_management || false);
  const [status, setStatus] = useState(department?.status || "active");
  const [validation, setValidation] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) { setValidation("Nhập tên ban từ 2 đến 160 ký tự."); return; }
    setValidation("");
    const r = await mutation.run((signal) =>
      workspaceRequest(
        token,
        clubId,
        department ? `departments/${department.department_id}` : "departments",
        {
          method: department ? "PATCH" : "POST",
          signal,
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            is_private: privateBan,
            is_management: management,
            status,
          }),
        },
      ),
    );
    if (r) done();
  }
  return (
    <div className="cw-dp-editor">
      <button type="button" className="cw-dp-back" aria-label="Quay lại Các ban" disabled={mutation.busy} onClick={close}><ArrowLeft size={16} aria-hidden="true" />Các ban</button>
      <header className="cw-heading"><div><h1>{department ? "Chỉnh sửa ban" : "Tạo ban"}</h1><p>{department ? "Cập nhật thông tin và thiết lập của ban." : "Thêm một ban mới vào cơ cấu CLB."}</p></div></header>
    <form className="cw-panel cw-department-form cw-dp-form" onSubmit={save}>
      <div className="cw-dp-form-fields">
        <label>
          Tên ban<span className="cw-dp-required" aria-hidden="true"> *</span>
          <input
            autoFocus
            required
            minLength={2}
            maxLength={160}
            value={name}
            onChange={(e) => { setName(e.target.value); setValidation(""); }}
            aria-invalid={!!validation}
            aria-describedby={validation ? "department-name-error" : undefined}
            disabled={mutation.busy}
          />
          {validation && <span id="department-name-error" className="cw-dp-field-error" role="alert">{validation}</span>}
        </label>
        <label>
          Mô tả <span className="cw-dp-optional">(tùy chọn)</span>
          <textarea aria-label="Mô tả" rows={3} maxLength={5000} value={description} onChange={e => setDescription(e.target.value)} disabled={mutation.busy} />
        </label>
        <label>
          Trạng thái
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
            disabled={mutation.busy || management}
          >
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Ngừng hoạt động</option>
          </select>
        </label>
        <div className="cw-dp-switches">
          <label className="cw-dp-switch"><input type="checkbox" role="switch" checked={management} onChange={e => { setManagement(e.target.checked); if (e.target.checked) setStatus("active"); }} disabled={mutation.busy || department?.is_management} /><span>Ban quản lý</span></label>
          <label className="cw-dp-switch"><input type="checkbox" role="switch" checked={privateBan} onChange={e => setPrivate(e.target.checked)} disabled={mutation.busy} /><span>Ban riêng tư</span></label>
        </div>
        {department?.is_management && <p className="cw-dp-form-note">Ban quản lý hiện có được giữ ở trạng thái đang hoạt động.</p>}
      {mutation.error && (
        <p role="alert" className="cw-error">
          {mutation.error}
        </p>
      )}
      </div>
      <footer className="cw-dp-form-footer">
        <button type="button" disabled={mutation.busy} onClick={close}>
          Quay lại
        </button>
        <button type="submit" className="cw-primary" disabled={mutation.busy}>
          {mutation.busy ? "Đang lưu…" : department ? "Lưu thay đổi" : "Tạo ban"}
        </button>
      </footer>
    </form>
    </div>
  );
}
