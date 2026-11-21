import { useEffect, useState } from "react";

import type { PublicItem, Collection } from "../discovery/types";
export type { PublicItem, Collection } from "../discovery/types";
export { safePublicUrl, publicDate } from "../../shared/lib/content-format";
const idKey = {
  clubs: "club_id",
  activities: "activity_id",
  posts: "post_id",
} as const;

export function usePublicContent(collection: Collection) {
  const [items, setItems] = useState<PublicItem[]>([]);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const base = (import.meta.env.VITE_API_URL?.trim() || "").replace(
      /\/$/,
      "",
    );
    void fetch(`${base}/api/public/${collection}?page=${page}&limit=12`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Không tải được nội dung. Vui lòng thử lại.");
        const result = await response.json();
        if (
          !Array.isArray(result.items) ||
          typeof result.hasMore !== "boolean" ||
          result.items.some(
            (item: PublicItem) =>
              !item || typeof item[idKey[collection]] !== "string",
          )
        ) {
          throw new Error("Dữ liệu từ máy chủ chưa hợp lệ. Vui lòng thử lại.");
        }
        if (controller.signal.aborted) return;
        setItems((previous) =>
          page === 1
            ? result.items
            : Array.from(
                new Map(
                  [...previous, ...result.items].map((item) => [
                    item[idKey[collection]],
                    item,
                  ]),
                ).values(),
              ),
        );
        setHasMore(result.hasMore);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Chưa tải được nội dung công khai. Vui lòng thử lại.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [collection, page, attempt]);
  return {
    items,
    loading,
    error,
    hasMore,
    retry: () => setAttempt((value) => value + 1),
    refresh: () => {
      setPage(1);
      setAttempt((value) => value + 1);
    },
    loadMore: () => {
      if (!loading && !error && hasMore) setPage((value) => value + 1);
    },
  };
}
