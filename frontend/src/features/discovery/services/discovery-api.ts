import { publicGet } from "../../../shared/api/public-http";
import type { PublicItem, Collection } from "../types";
export type { PublicItem, Collection };
export interface PublicPage {
  items: PublicItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}
export interface ClubCategory {
  category_id: string;
  name: string;
}
export async function getClubCategories(signal: AbortSignal) {
  const data = await publicGet<{ items: ClubCategory[] }>("club-categories", signal);
  if (!Array.isArray(data.items) || data.items.some((item) =>
    !item || typeof item.category_id !== "string" || typeof item.name !== "string"
  )) throw new Error("Danh mục loại CLB chưa hợp lệ.");
  return data.items;
}
export const itemId = (kind: Collection, item: PublicItem) =>
  kind === "clubs"
    ? item.club_id
    : kind === "activities"
      ? item.activity_id
      : item.post_id;
export const itemPath = (kind: Collection, item: PublicItem) =>
  kind==='activities'&&item.entry_type==='recruitment'?`/recruitments/${item.campaign_id||item.activity_id}`:`/${kind}/${itemId(kind, item)}`;

export async function getCollection(
  kind: Collection,
  params: string,
  signal: AbortSignal,
) {
  const data = await publicGet<PublicPage>(`${kind}?${params}`, signal);
  if (
    !Array.isArray(data.items) ||
    typeof data.hasMore !== "boolean" ||
    data.items.some((item) => !item || typeof itemId(kind, item) !== "string")
  ) {
    throw new Error("Dữ liệu chưa hợp lệ. Vui lòng thử tải lại.");
  }
  return data;
}
export async function getDetail(
  kind: Collection,
  id: string,
  signal: AbortSignal,
) {
  const data = await publicGet<{ item: PublicItem }>(
    `${kind}/${encodeURIComponent(id)}`,
    signal,
  );
  if (!data.item || itemId(kind, data.item) !== id)
    throw new Error("Nội dung trả về chưa hợp lệ.");
  return data.item;
}
