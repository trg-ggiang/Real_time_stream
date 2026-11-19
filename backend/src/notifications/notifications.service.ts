import { Injectable, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { SupabaseService } from "../supabase/supabase.service";
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  readonly events = new EventEmitter();
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(private readonly supabase: SupabaseService) {}
  onModuleInit() {
    this.timer = setInterval(() => { void this.deliver().catch(() => { /* Durable jobs retry on next tick; never log personal data. */ }); }, 5000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); this.events.removeAllListeners(); }
  async deliver() {
    if (this.running) return;
    this.running = true;
    try {
      const r = await this.supabase.client.rpc("recruitment_deliver_notifications", { p_limit: 25 });
      if (r.error) throw new ServiceUnavailableException("Hàng đợi thông báo chưa sẵn sàng.");
      for (const id of r.data?.recipient_ids || []) this.events.emit("changed", id);
    } finally { this.running = false; }
  }
  async list(actor: string, page: number, unread: boolean) {
    const query = this.supabase.client.from("notifications").select("notification_id,type,title,body,data,read_at,created_at", { count: "exact" }).eq("recipient_id", actor);
    if (unread) query.is("read_at", null);
    const [rows, count] = await Promise.all([
      query.order("created_at", { ascending: false }).order("notification_id").range((page - 1) * 20, page * 20 - 1),
      this.supabase.client.from("notifications").select("notification_id", { count: "exact", head: true }).eq("recipient_id", actor).is("read_at", null),
    ]);
    if (rows.error || count.error) throw new ServiceUnavailableException("Chưa tải được thông báo. Vui lòng thử lại.");
    return { items: rows.data || [], total: rows.count || 0, unread_count: count.count || 0, page, hasMore: page * 20 < (rows.count || 0) };
  }
  async read(actor: string, id: string | null) {
    const r = await this.supabase.client.rpc("recruitment_read_notifications", { p_actor: actor, p_id: id });
    if (r.error) throw new ServiceUnavailableException("Chưa cập nhật được thông báo.");
    this.events.emit("changed", actor);
    return r.data;
  }
}
