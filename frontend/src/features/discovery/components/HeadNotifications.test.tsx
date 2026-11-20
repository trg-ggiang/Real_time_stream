// @vitest-environment jsdom
import { createRef } from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HeadNotifications } from "./HeadNotifications";
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("opening the bell marks the snapshot read and clears the persisted unread badge",async()=>{
 const fetcher=vi.fn(async()=>({ok:true,json:async()=>({items:[{notification_id:'n',title:'Trưởng ban mới',body:'Bạn được bổ nhiệm',created_at:'2026-11-20T00:00:00Z',data:{club_id:'club'}}],unread_count:1,read_through:'2026-11-20T01:00:00Z'})}));vi.stubGlobal('fetch',fetcher);
 render(<MemoryRouter><HeadNotifications token="token" panelRef={createRef()} /></MemoryRouter>);
 await screen.findByLabelText('1 thông báo chưa đọc');expect(fetcher.mock.calls).toHaveLength(1);
 fireEvent.click(screen.getByLabelText('Thông báo'));
 await waitFor(()=>expect(screen.queryByLabelText('1 thông báo chưa đọc')).toBeNull());
 const calls=fetcher.mock.calls as unknown as [string,RequestInit][];
 expect(calls[1][0]).toBe('/api/me/head-notifications/read');expect(JSON.parse(String(calls[1][1].body))).toEqual({through:'2026-11-20T01:00:00Z'});
 expect(screen.getByRole('link',{name:'Mở CLB →'}).getAttribute('href')).toBe('/workspace/club');
});
it("does not clear the unread badge when marking read fails",async()=>{
 vi.stubGlobal('fetch',vi.fn(async(_url,options)=>options.method==='PUT'?{ok:false,status:503,json:async()=>({message:'Chưa cập nhật được'})}:{ok:true,json:async()=>({items:[],unread_count:1,read_through:'2026-11-20T01:00:00Z'})}));
 render(<MemoryRouter><HeadNotifications token="token" panelRef={createRef()} /></MemoryRouter>);await screen.findByLabelText('1 thông báo chưa đọc');fireEvent.click(screen.getByLabelText('Thông báo'));await screen.findByRole('alert');expect(screen.getByLabelText('1 thông báo chưa đọc')).toBeTruthy();
});
