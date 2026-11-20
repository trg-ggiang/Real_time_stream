// @vitest-environment jsdom
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ClubContext, type WorkspaceSession } from "./workspace-context";
import { MembersPage } from "./pages/WorkspacePeople";
import { PersonalOverview } from "../personal/pages/PersonalLists";
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
const session={token:'token',clubId:'club',membership:{role:'chairperson'},reload:vi.fn()} as unknown as WorkspaceSession;
it.each(['member','head'])("uses a separate head endpoint for %s without a chair transfer",async(role)=>{
 vi.spyOn(window,'confirm').mockReturnValue(true);
 const fetcher=vi.fn(async(url:string)=>({ok:true,json:async()=>url.includes('/departments')?{items:[{department_id:'dept',name:'Kỹ thuật',status:'active',is_management:false}]}:{items:[{membership_id:'m',role,department_id:'dept',updated_at:'2026-11-20T00:00:00.123456Z',users:{display_name:'Hải'},club_departments:{name:'Kỹ thuật'}}]}}));vi.stubGlobal('fetch',fetcher);
 render(<MemoryRouter><ClubContext.Provider value={session}><MembersPage /></ClubContext.Provider></MemoryRouter>);
 const name=role==='member'?'Chuyển trưởng ban':'Gỡ trưởng ban';const button=await screen.findByRole('button',{name}); await waitFor(()=>expect((button as HTMLButtonElement).disabled).toBe(false));fireEvent.click(button);
 await waitFor(()=>expect(fetcher.mock.calls.some(c=>c[0]==='/api/workspace/club/members/m/head')).toBe(true));
 const calls=fetcher.mock.calls as unknown as [string,RequestInit][];const write=calls.find(c=>c[0].endsWith('/head'))!;expect(JSON.parse(String(write[1].body))).toEqual({is_head:role==='member',expected_updated_at:'2026-11-20T00:00:00.123456Z'});expect(calls.some(c=>c[0].includes('transfer-chair'))).toBe(false);
});
it('community overview displays head as Trưởng ban',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>({items:url.includes('me/clubs?')?[{membership_id:'m',role:'head',club:{club_id:'club',name:'CLB Kỹ thuật'}}]:[],total:1})})));
 render(<MemoryRouter><PersonalOverview token="token" displayName="Hải" /></MemoryRouter>);expect(await screen.findByText('Trưởng ban')).toBeTruthy();
});
