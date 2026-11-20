import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
@Injectable()
export class HeadNotifications {
  private readonly types = ['department.head_assigned','recruitment.application','recruitment.accepted','recruitment.rejected'];
  constructor(private readonly supabase: SupabaseService) {}
  async list(actor: string) {
    const through = new Date().toISOString();
    const base = () => this.supabase.client.from("notifications");
    const [rows, count] = await Promise.all([
      base().select("notification_id,title,body,data,created_at,read_at").eq("recipient_id", actor).in("type", this.types).lte("created_at", through).order("created_at", { ascending: false }).order("notification_id").limit(50),
      base().select("notification_id", { count: "exact", head: true }).eq("recipient_id", actor).in("type", this.types).is("read_at", null).lte("created_at", through),
    ]);
    if (rows.error || count.error) throw new ServiceUnavailableException("Chưa tải được thông báo.");
    return { items: rows.data || [], unread_count: count.count || 0, read_through: through };
  }
  async read(actor: string, through: string) {
    const r = await this.supabase.client.rpc("clubspace_read_head_notifications", { p_actor: actor, p_through: through });
    if (r.error) throw new ServiceUnavailableException("Chưa đánh dấu được thông báo đã xem.");
    return { updated: r.data };
  }
}
