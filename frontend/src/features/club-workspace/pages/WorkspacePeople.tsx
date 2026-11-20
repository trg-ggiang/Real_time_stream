import { confirmAction } from '../../../shared/lib/confirm-action';
import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
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
export function MembersPage() {
  const { token, clubId, membership, reload } = useClub();
  const [params, setParams] = useSearchParams();
  const n = Number(params.get("page") || 1),
    page = Number.isInteger(n) ? Math.max(1, Math.min(10000, n)) : 1;
  const state = usePersonalQuery<WorkspaceList<Member>>(
    token,
    `workspace/${clubId}/members?page=${page}&limit=12`,
  );
  const depts = usePersonalQuery<WorkspaceList<Department>>(
    token,
    `workspace/${clubId}/departments`,
  );
  const mutation = useWorkspaceMutation();
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [message, setMessage] = useState("");
  const chair = membership.role === "chairperson";
  async function add(event: FormEvent) {
    event.preventDefault();
    const r = await mutation.run((signal) =>
      workspaceRequest(token, clubId, "members", {
        method: "POST",
        signal,
        body: JSON.stringify({
          email: email.trim(),
          department_id: department,
        }),
      }),
    );
    if (r) {
      setEmail("");
      setMessage("Đã thêm tài khoản vào CLB.");
      state.retry();
    }
  }
  return (
    <>
      <div className="cw-heading">
        <div>
          <h1>Những người cùng CLB</h1>
          <p>
            Mỗi thành viên thuộc một ban. Vai trò chủ nhiệm chỉ có hiệu lực
            trong CLB này.
          </p>
        </div>
        <span className="cw-count">{state.data?.total ?? "…"} thành viên</span>
      </div>
      {chair && (
        <section className="cw-panel">
          <h2>Thêm thành viên</h2>
          <p className="cw-muted">
            Dùng email tài khoản đã đăng ký. Đây là thêm trực tiếp, chưa gửi lời
            mời qua email.
          </p>
          <form className="cw-inline-form" onSubmit={add}>
            <label>
              Email tài khoản
              <input
                type="email"
                required
                maxLength={320}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={mutation.busy}
              />
            </label>
            <label>
              Ban
              <select
                value={department}
                required
                onChange={(e) => setDepartment(e.target.value)}
                disabled={mutation.busy || !depts.data}
              >
                <option value="">Chọn ban</option>
                {depts.data?.items
                  .filter((d) => d.status === "active")
                  .map((d) => (
                    <option key={d.department_id} value={d.department_id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </label>
            <button className="cw-primary" disabled={mutation.busy}>
              Thêm thành viên
            </button>
          </form>
          {mutation.error && (
            <p role="alert" className="cw-error">
              {mutation.error}
            </p>
          )}
          {message && (
            <p role="status" className="cw-success">
              {message}
            </p>
          )}
        </section>
      )}
      {depts.error && <PersonalState {...depts} />}
      <section className="cw-panel">
        {state.data?.items.length ? (
          <div className="cw-members">
            {state.data.items.map((member) => (
              <MemberRow
                key={member.membership_id + ":" + member.department_id + ":" + member.role}
                member={member}
                departments={depts.data?.items || []}
                chair={chair}
                refresh={() => {
                  state.retry();
                  reload();
                }}
              />
            ))}
          </div>
        ) : (
          <PersonalState {...state} empty="Chưa có thành viên để hiển thị." />
        )}
      </section>
      <nav className="cw-pagination" aria-label="Phân trang thành viên">
        <button
          disabled={page === 1 || state.loading}
          onClick={() => setParams({ page: String(page - 1) })}
        >
          ← Trước
        </button>
        <span>Trang {page}</span>
        <button
          disabled={!state.data?.hasMore || state.loading}
          onClick={() => setParams({ page: String(page + 1) })}
        >
          Sau →
        </button>
      </nav>
    </>
  );
}
function MemberRow({
  member,
  departments,
  chair,
  refresh,
}: {
  member: Member;
  departments: Department[];
  chair: boolean;
  refresh: () => void;
}) {
  const { token, clubId } = useClub();
  const mutation = useWorkspaceMutation();
  const [department, setDepartment] = useState(member.department_id);
  const [message, setMessage] = useState("");
  async function action(kind: "move" | "remove" | "transfer" | "head" | "unhead") {
    if (
      kind !== "move" &&
      !(await confirmAction(
        kind === "remove"
          ? `Xóa ${member.users.display_name} khỏi CLB?`
          : kind === "head" ? `Chọn ${member.users.display_name} làm trưởng ${member.club_departments.name}?`
          : kind === "unhead" ? `Gỡ quyền trưởng ban của ${member.users.display_name}? Thành viên vẫn ở ban hiện tại.`
          : `Chuyển quyền chủ nhiệm cho ${member.users.display_name}? Bạn sẽ trở thành thành viên.`,
      ))
    )
      return;
    const path =
      kind === "transfer"
        ? "transfer-chair"
        : `members/${member.membership_id}/${kind === "move" ? "department" : kind === "head" || kind === "unhead" ? "head" : "remove"}`;
    const body =
      kind === "move"
        ? { department_id: department }
        : kind === "transfer"
          ? { membership_id: member.membership_id }
          : kind === "head" || kind === "unhead" ? { is_head: kind === "head", expected_updated_at: member.updated_at } : undefined;
    const r = await mutation.run((signal) =>
      workspaceRequest(token, clubId, path, {
        method: kind === "move" || kind === "head" || kind === "unhead" ? "PATCH" : "POST",
        signal,
        ...(body && { body: JSON.stringify(body) }),
      }),
    );
    if (r) {
      setMessage("Đã cập nhật thành viên.");
      refresh();
    }
  }
  return (
    <article className="cw-member">
      <ContentImage
        src={member.users.avatar_url}
        alt=""
        className="cw-member-photo"
        fallbackText={Array.from(member.users.display_name.trim())[0] || "?"}
      />
      <div>
        <h2>{member.users.display_name}</h2>
        <p>
          {member.role === "chairperson" ? "Chủ nhiệm" : member.role === "head" ? "Trưởng ban" : "Thành viên"} ·{" "}
          {member.club_departments.name}
        </p>
        {chair && member.role !== "chairperson" && (
          <div className="cw-member-tools">
            <label className="cw-sr-label">
              Chuyển ban cho {member.users.display_name}
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={mutation.busy || member.role === "head"}
              >
                {departments
                  .filter((d) => d.status === "active")
                  .map((d) => (
                    <option key={d.department_id} value={d.department_id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              disabled={mutation.busy || member.role === "head" || department === member.department_id}
              onClick={() => action("move")}
            >
              Lưu thay đổi
            </button>
            <button disabled={mutation.busy || member.role !== "member"} onClick={() => action("transfer")}>
              Chuyển chủ nhiệm
            </button>
            <button disabled={mutation.busy || member.role !== "member" || !member.updated_at || !departments.some(d => d.department_id === member.department_id && d.status === "active" && !d.is_management)} onClick={() => action("head")}>Chuyển trưởng ban</button>
            <button disabled={mutation.busy || member.role !== "head" || !member.updated_at} onClick={() => action("unhead")}>Gỡ trưởng ban</button>
            <button
              className="cw-danger"
              disabled={mutation.busy || member.role === "head"}
              onClick={() => action("remove")}
            >
              Xóa thành viên
            </button>
          </div>
        )}
        {mutation.error && (
          <p role="alert" className="cw-error">
            {mutation.error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </div>
    </article>
  );
}
export function DepartmentsPage() {
  const { token, clubId, membership } = useClub();
  const result = usePersonalQuery<WorkspaceList<Department>>(
    token,
    `workspace/${clubId}/departments`,
  );
  const [editing, setEditing] = useState<Department | null>(null);
  const [show, setShow] = useState(false);
  return (
    <>
      <div className="cw-heading">
        <div>
          <h1>Các ban trong CLB</h1>
          <p>
            Công khai: thành viên CLB có thể xem kênh. Riêng tư: chỉ người được cấp quyền mới có thể truy cập.
          </p>
        </div>
        {membership.role === "chairperson" && (
          <button
            className="cw-primary"
            onClick={() => {
              setEditing(null);
              setShow(true);
            }}
          >
            Tạo ban
          </button>
        )}
      </div>
      {show && (
        <DepartmentForm
          key={editing?.department_id || "new"}
          department={editing}
          close={() => setShow(false)}
          done={() => {
            setShow(false);
            result.retry();
            window.dispatchEvent(new CustomEvent('uc:workspace-channels-changed', { detail: clubId }));
          }}
        />
      )}
      {result.data?.items.length ? (
        <div className="cw-department-grid">
          {result.data.items.map((d) => (
            <article className="cw-panel" key={d.department_id}>
              <span className="cw-status">
                {d.is_management
                  ? "Ban quản trị"
                  : d.is_private
                    ? "Riêng tư"
                    : "Công khai"}
              </span>
              <h2>{d.name}</h2>
              <p>{d.description || "Chưa có mô tả."}</p>
              <p className="cw-muted">
                {d.status === "active"
                  ? "Đang hoạt động"
                  : "Đã ngừng hoạt động"}
              </p>
              {membership.role === "chairperson" && (
                <button
                  onClick={() => {
                    setEditing(d);
                    setShow(true);
                  }}
                >
                  Chỉnh sửa ban
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <PersonalState {...result} empty="Chưa có thông tin ban." />
      )}
    </>
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
  const [status, setStatus] = useState(department?.status || "active");
  async function save(e: FormEvent) {
    e.preventDefault();
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
            status,
          }),
        },
      ),
    );
    if (r) done();
  }
  return (
    <form className="cw-panel cw-department-form" onSubmit={save}>
      <h2>{department ? "Chỉnh sửa ban" : "Tạo ban mới"}</h2>
      <div className="cw-form-grid">
        <label>
          Tên ban
          <input
            required
            minLength={2}
            maxLength={160}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={mutation.busy}
          />
        </label>
        <label>
          Trạng thái
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
            disabled={mutation.busy || department?.is_management}
          >
            <option value="active">Hoạt động</option>
            <option value="inactive">Ngừng hoạt động</option>
          </select>
        </label>
        <label>
          Mô tả
          <textarea
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={mutation.busy}
          />
        </label>
        <fieldset className="cw-department-visibility"><legend>Quyền truy cập kênh</legend><label><input type="radio" name="department-visibility" checked={!privateBan} onChange={() => setPrivate(false)} disabled={mutation.busy} />Công khai</label><label><input type="radio" name="department-visibility" checked={privateBan} onChange={() => setPrivate(true)} disabled={mutation.busy} />Riêng tư</label><p className="cw-muted">Công khai trong CLB, không hiển thị cho khách bên ngoài.</p></fieldset>
      </div>
      <p className="cw-muted">
        Chuyển hết thành viên đang hoạt động trước khi ngừng một ban. Ban quản
        trị không được ngừng.
      </p>
      {mutation.error && (
        <p role="alert" className="cw-error">
          {mutation.error}
        </p>
      )}
      <div className="cw-actions">
        <button type="button" disabled={mutation.busy} onClick={close}>
          Đóng
        </button>
        <button className="cw-primary" disabled={mutation.busy}>
          {department ? 'Lưu thay đổi' : 'Tạo ban'}
        </button>
      </div>
    </form>
  );
}
