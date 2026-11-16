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
                key={member.membership_id + ":" + member.department_id}
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
  async function action(kind: "move" | "remove" | "transfer") {
    if (
      kind !== "move" &&
      !window.confirm(
        kind === "remove"
          ? `Gỡ ${member.users.display_name} khỏi CLB?`
          : `Chuyển quyền chủ nhiệm cho ${member.users.display_name}? Bạn sẽ trở thành thành viên.`,
      )
    )
      return;
    const path =
      kind === "transfer"
        ? "transfer-chair"
        : `members/${member.membership_id}/${kind === "move" ? "department" : "remove"}`;
    const body =
      kind === "move"
        ? { department_id: department }
        : kind === "transfer"
          ? { membership_id: member.membership_id }
          : undefined;
    const r = await mutation.run((signal) =>
      workspaceRequest(token, clubId, path, {
        method: kind === "move" ? "PATCH" : "POST",
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
      />
      <div>
        <h2>{member.users.display_name}</h2>
        <p>
          {member.role === "chairperson" ? "Chủ nhiệm" : "Thành viên"} ·{" "}
          {member.club_departments.name}
        </p>
        {chair && member.role !== "chairperson" && (
          <div className="cw-member-tools">
            <label className="cw-sr-label">
              Chuyển ban cho {member.users.display_name}
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={mutation.busy}
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
              disabled={mutation.busy || department === member.department_id}
              onClick={() => action("move")}
            >
              Lưu ban
            </button>
            <button disabled={mutation.busy} onClick={() => action("transfer")}>
              Chuyển chủ nhiệm
            </button>
            <button
              className="cw-danger"
              disabled={mutation.busy}
              onClick={() => action("remove")}
            >
              Gỡ thành viên
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
            Ban riêng tư là cấu hình cho kênh trao đổi tương lai; hiện chưa có
            tính năng chat theo ban.
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
                    : "Chung trong CLB"}
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
        <label className="cw-checkbox">
          <input
            type="checkbox"
            checked={privateBan}
            onChange={(e) => setPrivate(e.target.checked)}
            disabled={mutation.busy}
          />
          Ban riêng tư
        </label>
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
          Lưu ban
        </button>
      </div>
    </form>
  );
}
