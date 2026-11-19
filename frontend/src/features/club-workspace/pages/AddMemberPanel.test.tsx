// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {ClubContext,type WorkspaceSession} from "../workspace-context";
import {AddMemberPanel} from "./AddMemberPanel";
import type {Department} from "../services/workspace-api";
const context:WorkspaceSession={token:"test",clubId:"club",reload:()=>{},club:{club_id:"club",name:"AE 18",summary:"",description:"",mission:null,logo_url:null,cover_url:null,contact_email:null,contact_phone:null},membership:{membership_id:"chair",user_id:"actor",club_id:"club",department_id:"management",role:"chairperson"}};
const departments:Department[]=[{department_id:"tech",name:"Ban Kỹ thuật",description:null,is_management:false,is_private:false,status:"active"},{department_id:"management",name:"Ban quản lý",description:null,is_management:true,is_private:false,status:"active"},{department_id:"closed",name:"Ban cũ",description:null,is_management:false,is_private:false,status:"inactive"}];
const user={user_id:"candidate",display_name:"Nguyễn Minh Anh",email:"minhanh@example.com",avatar_url:null};
const request=vi.fn();const added=vi.fn(),cancel=vi.fn();
function show(role:WorkspaceSession["membership"]["role"]="chairperson"){return render(<ClubContext.Provider value={{...context,membership:{...context.membership,role}}}><AddMemberPanel departments={departments} onAdded={added} onCancel={cancel}/></ClubContext.Provider>);}
beforeEach(()=>{request.mockReset();added.mockReset();cancel.mockReset();request.mockImplementation(async (_url:string,options?:RequestInit)=>({ok:true,status:200,json:async()=>options?.method==="POST"?{item:{membership_id:"new"}}:{items:[user]}}));vi.stubGlobal("fetch",request);});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it.each(["member","head"] as const)("hides the form and skips account lookup for %s",role=>{show(role);expect(screen.queryByRole("searchbox")).toBeNull();expect(request).not.toHaveBeenCalled();});
it("selects an account and submits the chosen department and head role",async()=>{
 show();expect((screen.getByRole("button",{name:"Xác nhận thêm"}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.change(screen.getByRole("searchbox",{name:/Người dùng/}),{target:{value:"Minh"}});
 fireEvent.click(await screen.findByRole("button",{name:/Nguyễn Minh Anh/}));
 fireEvent.change(screen.getByRole("combobox",{name:/Ban/}),{target:{value:"tech"}});
 fireEvent.click(screen.getByRole("radio",{name:"Trưởng ban"}));
 expect(screen.getByText("Người này sẽ phụ trách Ban Kỹ thuật.")).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Xác nhận thêm"}));
 await waitFor(()=>expect(added).toHaveBeenCalledOnce());
 expect(request).toHaveBeenCalledWith("/api/workspace/club/members",expect.objectContaining({method:"POST",body:JSON.stringify({email:user.email,department_id:"tech",role:"head"})}));
});
it("resets the head option for management and keeps inactive departments unavailable",()=>{
 show();fireEvent.change(screen.getByRole("combobox",{name:/Ban/}),{target:{value:"tech"}});fireEvent.click(screen.getByRole("radio",{name:"Trưởng ban"}));
 fireEvent.change(screen.getByRole("combobox",{name:/Ban/}),{target:{value:"management"}});
 expect((screen.getByRole("radio",{name:"Trưởng ban"}) as HTMLInputElement).disabled).toBe(true);
 expect((screen.getByRole("radio",{name:"Thành viên"}) as HTMLInputElement).checked).toBe(true);
 expect(screen.queryByRole("option",{name:"Ban cũ"})).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Hủy"}));expect(cancel).toHaveBeenCalledOnce();expect(request).not.toHaveBeenCalled();
});
it("keeps selection and reports a save failure for retry",async()=>{
 request.mockImplementation(async (_url:string,options?:RequestInit)=>({ok:options?.method!=="POST",status:options?.method==="POST"?409:200,json:async()=>options?.method==="POST"?{message:"Tài khoản đã có trong CLB."}:{items:[user]}}));
 show();fireEvent.change(screen.getByRole("searchbox",{name:/Người dùng/}),{target:{value:"Minh"}});fireEvent.click(await screen.findByRole("button",{name:/Nguyễn Minh Anh/}));fireEvent.change(screen.getByRole("combobox",{name:/Ban/}),{target:{value:"tech"}});fireEvent.click(screen.getByRole("button",{name:"Xác nhận thêm"}));
 expect(await screen.findByRole("alert")).toBeTruthy();expect(screen.getByText(user.email)).toBeTruthy();expect(added).not.toHaveBeenCalled();
});
