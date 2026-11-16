export interface PublicItem {
  club_id: string;
  name?: string;
  club_name?: string;
  activity_id?: string;
  post_id?: string;
  title?: string;
  summary?: string;
  description?: string;
  mission?: string;
  content?: string;
  logo_url?: string;
  club_logo_url?: string;
  cover_url?: string;
  contact_email?: string;
  contact_phone?: string;
  starts_at?: string;
  ends_at?: string;
  format?: string;
  location_name?: string;
  location_address?: string;
  registration_opens_at?: string;
  registration_closes_at?: string;
  capacity?: number;
  lifecycle_status?: string;
  published_at?: string;
}
export type Collection = "clubs" | "activities" | "posts";
