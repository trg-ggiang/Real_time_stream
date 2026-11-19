import {useEffect,useRef,useState,type FormEvent} from "react";
import {MagnifyingGlass} from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import {Check} from "@phosphor-icons/react/dist/csr/Check";
import {ContentImage} from "../../discovery/components/PublicContent";
import {useClub} from "../workspace-context";
import {useWorkspaceMutation} from "../use-workspace-mutation";
import {workspaceRequest,type Department} from "../services/workspace-api";

interface Candidate {user_id:string;display_name:string;email:string;avatar_url:string|null}
export function AddMemberPanel({departments,initialDepartment="",onCancel,onAdded}:{departments:Department[];initialDepartment?:string;onCancel:()=>void;onAdded:()=>void}) {
  const {token,clubId,membership}=useClub();
  const mutation=useWorkspaceMutation();
  const [query,setQuery]=useState("");
  const [selected,setSelected]=useState<Candidate|null>(null);
  const [candidates,setCandidates]=useState<Candidate[]>([]);
  const [loading,setLoading]=useState(false);
  const [lookupError,setLookupError]=useState("");
  const [searched,setSearched]=useState(false);
  const [department,setDepartment]=useState(initialDepartment);
  const [role,setRole]=useState<"member"|"head">("member");
  const input=useRef<HTMLInputElement>(null);
  const activeDepartments=departments.filter(item=>item.status==="active");
  const chosenDepartment=activeDepartments.find(item=>item.department_id===department);
  useEffect(()=>{
    const controller=new AbortController();
    setLookupError("");setCandidates([]);setSearched(false);setLoading(false);
    if(membership.role!=="chairperson"||selected||query.trim().length<2)return()=>controller.abort();
    setLoading(true);
    const timer=window.setTimeout(()=>{
      void workspaceRequest<{items:Candidate[]}>(token,clubId,"member-candidates?q="+encodeURIComponent(query.trim()),{signal:controller.signal})
        .then(data=>{if(!controller.signal.aborted){setCandidates(data.items);setSearched(true);}})
        .catch(error=>{if(!controller.signal.aborted)setLookupError(error.message);})
        .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    },300);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[query,selected,token,clubId,membership.role]);
  if(membership.role!=="chairperson")return null;
  async function submit(event:FormEvent) {
    event.preventDefault();
    if(!selected||!chosenDepartment||mutation.busy)return;
    const result=await mutation.run(signal=>workspaceRequest(token,clubId,"members",{method:"POST",signal,body:JSON.stringify({email:selected.email,department_id:department,role})}));
    if(result)onAdded();
  }
  const initials=(name:string)=>name.trim().split(/\s+/).slice(-2).map(part=>part[0]).join("").toLocaleUpperCase("vi-VN")||"TV";
  return <section className="cw-member-add-panel" aria-label="Thêm thành viên vào CLB">
    <div className="cw-member-add-intro"><h2>Thêm thành viên</h2><p>Chọn tài khoản đã đăng ký và phân công vào ban phù hợp.</p></div>
    <form className="cw-member-add-form" onSubmit={submit}>
      <div className="cw-member-add-field">
        <label htmlFor="member-user-search">Người dùng <span className="cw-member-required" aria-hidden="true">*</span></label>
        <div className="cw-member-user-search"><MagnifyingGlass size={19} aria-hidden="true"/><input ref={input} id="member-user-search" type="search" autoComplete="off" maxLength={100} value={query} disabled={mutation.busy||!!selected} placeholder="Tìm theo tên hoặc email" onChange={event=>setQuery(event.target.value)} aria-describedby="member-search-help"/></div>
        <small id="member-search-help">Nhập ít nhất 2 ký tự để tìm tài khoản chưa có trong CLB.</small>
        {loading&&<p className="cw-member-search-state" role="status">Đang tìm tài khoản…</p>}
        {lookupError&&<p className="cw-error" role="alert">{lookupError}</p>}
        {searched&&!loading&&!candidates.length&&!selected&&<p className="cw-member-search-state" role="status">Không tìm thấy tài khoản phù hợp chưa thuộc CLB.</p>}
        {!selected&&candidates.length>0&&<ul className="cw-member-candidate-list" aria-label="Tài khoản tìm được">{candidates.map(user=><li key={user.user_id}><button type="button" className="cw-member-user-card" onClick={()=>{setSelected(user);setCandidates([]);setQuery("");}}><ContentImage src={user.avatar_url} alt="" className="cw-member-picker-avatar" fallbackText={initials(user.display_name)}/><span className="cw-member-user-copy"><strong>{user.display_name}</strong><small>{user.email}</small></span><span className="cw-member-pick-label">Chọn</span></button></li>)}</ul>}
        {selected&&<div className="cw-member-user-card is-selected"><ContentImage src={selected.avatar_url} alt="" className="cw-member-picker-avatar" fallbackText={initials(selected.display_name)}/><span className="cw-member-user-copy"><strong>{selected.display_name}</strong><small>{selected.email}</small></span><Check className="cw-member-selected-check" size={21} aria-label="Đã chọn"/><button className="cw-member-change-user" type="button" disabled={mutation.busy} onClick={()=>{setSelected(null);setQuery("");window.setTimeout(()=>input.current?.focus(),0);}}>Đổi</button></div>}
      </div>
      <div className="cw-member-add-field"><label htmlFor="member-add-department">Ban <span className="cw-member-required" aria-hidden="true">*</span></label><select id="member-add-department" required value={department} disabled={mutation.busy||!!initialDepartment} onChange={event=>{setDepartment(event.target.value);if(activeDepartments.find(item=>item.department_id===event.target.value)?.is_management)setRole("member");}}><option value="">Chọn ban</option>{activeDepartments.map(item=><option key={item.department_id} value={item.department_id}>{item.name}</option>)}</select>{!activeDepartments.length&&<small>Tạo ban đang hoạt động trong Cơ cấu CLB trước khi thêm thành viên.</small>}</div>
      <fieldset className="cw-member-role-field" disabled={mutation.busy}><legend>Vai trò <span className="cw-member-required" aria-hidden="true">*</span></legend><div className="cw-member-role-options">
        <label className={"cw-member-role-option"+(role==="member"?" is-selected":"")}><input type="radio" name="member-role" value="member" checked={role==="member"} onChange={()=>setRole("member")}/><span>Thành viên</span></label>
        <label className={"cw-member-role-option"+(role==="head"?" is-selected":"")+(chosenDepartment?.is_management?" is-disabled":"")}><input type="radio" name="member-role" value="head" checked={role==="head"} disabled={!!chosenDepartment?.is_management} onChange={()=>setRole("head")}/><span>Trưởng ban</span></label>
      </div><p className="cw-member-role-help">{role==="head"?(chosenDepartment?"Người này sẽ phụ trách "+chosenDepartment.name+".":"Chọn ban mà người này sẽ phụ trách."):"Thành viên tham gia sinh hoạt và hoạt động của ban."}</p></fieldset>
      {mutation.error&&<p className="cw-error" role="alert">{mutation.error}</p>}
      <div className="cw-member-add-actions"><button type="button" className="cw-member-cancel" disabled={mutation.busy} onClick={onCancel}>Hủy</button><button type="submit" className="cw-primary" disabled={mutation.busy||!selected||!chosenDepartment}>{mutation.busy?"Đang thêm…":"Xác nhận thêm"}</button></div>
    </form>
  </section>;
}
