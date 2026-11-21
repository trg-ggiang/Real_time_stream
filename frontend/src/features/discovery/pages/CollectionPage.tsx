import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { useCollection } from "../hooks/use-public-query";
import { ContentCards, QueryState } from "../components/PublicContent";
import { ClubCategoryFilter } from "../components/ClubCategoryFilter";
import type { Collection } from "../services/discovery-api";
const titles = {
  clubs: [
    "Tìm một nơi thuộc về.",
    "Khám phá những cộng đồng cùng sở thích tại Bách khoa.",
  ],
  activities: [
    "Ra ngoài. Gặp nhau.",
    "Một lịch hẹn mới cho những trải nghiệm ngoài giảng đường.",
  ],
  posts: [
    "Chuyện từ cộng đồng.",
    "Những ý tưởng, trải nghiệm và dấu ấn được CLB chia sẻ.",
  ],
};

export function CollectionPage({ kind }: { kind: Collection }) {
  const [params, setParams] = useSearchParams();
  const q = params.get("q")?.slice(0, 100) || "";
  const rawPage = Number(params.get("page") || 1);
  const page = Number.isInteger(rawPage)
    ? Math.max(1, Math.min(10000, rawPage))
    : 1;
  const period = ["upcoming", "past"].includes(params.get("period") || "")
    ? params.get("period")!
    : "all";
  const category = kind === "clubs" ? params.get("category") || "" : "";
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);
  const query = new URLSearchParams({
    page: String(page),
    limit: "12",
    ...(q && { q }),
    ...(category && { category }),
    ...(kind === "activities" && { period }),
  });
  const result = useCollection(kind, query.toString());
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values))
      value ? next.set(key, value) : next.delete(key);
    setParams(next);
  }
  return (
    <div className="dc-container dc-list-page">
      <Link className="dc-back" to="/">
        ← Khám phá
      </Link>
      <div className="dc-list-heading">
        <h1>{titles[kind][0]}</h1>
        <p>{titles[kind][1]}</p>
      </div>
      <div className="dc-list-toolbar">
        <form
          className="dc-search"
          onSubmit={(event) => {
            event.preventDefault();
            update({ q: draft.trim(), page: "" });
          }}
        >
          <MagnifyingGlass aria-hidden="true" size={22} />
          <label htmlFor="list-search" className="dc-sr-only">
            Tìm theo {kind === "clubs" ? "tên CLB" : "tiêu đề"}
          </label>
          <input
            id="list-search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={100}
            placeholder={
              kind === "clubs" ? "Tìm theo tên CLB…" : "Tìm theo tiêu đề…"
            }
          />
          <button type="submit">Tìm kiếm</button>
        </form>
        {kind === "clubs" && (
          <ClubCategoryFilter
            value={category}
            onChange={(value) => update({ category: value, page: "" })}
          />
        )}
        {kind === "activities" && (
          <label className="dc-period">
            Thời gian
            <select
              value={period}
              onChange={(event) =>
                update({
                  period:
                    event.target.value === "all" ? "" : event.target.value,
                  page: "",
                })
              }
            >
              <option value="all">Tất cả</option>
              <option value="upcoming">Sắp diễn ra</option>
              <option value="past">Đã kết thúc</option>
            </select>
          </label>
        )}
      </div>
      <p className="dc-result-count" role="status">
        {result.loading
          ? "Đang tìm nội dung…"
          : result.error
            ? "Chưa tải được kết quả"
            : `${result.data?.total ?? 0} kết quả${q ? ` cho “${q}”` : ""}`}
      </p>
      {result.data?.items.length ? (
        <ContentCards kind={kind} items={result.data.items} />
      ) : (
        <QueryState
          {...result}
          empty={kind === "clubs"
            ? "Chưa có câu lạc bộ phù hợp. Thử loại CLB hoặc từ khóa khác."
            : "Chưa có nội dung phù hợp. Thử từ khóa hoặc khoảng thời gian khác."}
        />
      )}
      {(q || category || (kind === "activities" && period !== "all")) && !result.loading && (
        <button
          className="dc-clear"
          onClick={() => {
            setDraft("");
            setParams({});
          }}
        >
          Xóa bộ lọc
        </button>
      )}
      <nav className="dc-pagination" aria-label="Phân trang">
        <button
          disabled={page <= 1 || result.loading}
          onClick={() => update({ page: String(page - 1) })}
        >
          ← Trang trước
        </button>
        <span>Trang {page}</span>
        <button
          disabled={!result.data?.hasMore || result.loading}
          onClick={() => update({ page: String(page + 1) })}
        >
          Trang sau →
        </button>
      </nav>
    </div>
  );
}
