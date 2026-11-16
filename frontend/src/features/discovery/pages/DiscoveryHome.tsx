import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { useCollection } from "../hooks/use-public-query";
import {
  ContentCards,
  ContentImage,
  QueryState,
} from "../components/PublicContent";

export function DiscoveryHome() {
  const navigate = useNavigate();
  const clubs = useCollection("clubs", "page=1&limit=12");
  const upcoming = useCollection(
    "activities",
    "page=1&limit=3&period=upcoming",
  );
  const recent = useCollection("activities", "page=1&limit=12");
  const posts = useCollection("posts", "page=1&limit=3");
  const hasUpcoming = Boolean(upcoming.data?.items.length);
  const activities =
    upcoming.error || hasUpcoming
      ? upcoming
      : upcoming.loading
        ? upcoming
        : recent;
  // Home is an editorial preview. Full lists retain server order and every record.
  const preview = (items: import("../services/discovery-api").PublicItem[]) =>
    [...items]
      .sort(
        (a, b) => Number(Boolean(b.cover_url)) - Number(Boolean(a.cover_url)),
      )
      .slice(0, 3);
  return (
    <>
      <section className="dc-hero dc-container">
        <div className="dc-hero-copy">
          <h1 className="dc-hero-title">
            <span className="dc-title-line">Tìm cộng đồng.</span>{" "}
            <span className="dc-title-line">Mở lối đam mê.</span>
          </h1>
          <p>
            Một nơi để khám phá CLB, gặp những người cùng sở thích và viết tiếp
            câu chuyện Bách khoa của bạn.
          </p>
          <form
            className="dc-search dc-hero-search"
            onSubmit={(event) => {
              event.preventDefault();
              const q = String(
                new FormData(event.currentTarget).get("q") || "",
              ).trim();
              navigate(`/clubs${q ? `?q=${encodeURIComponent(q)}` : ""}`);
            }}
          >
            <MagnifyingGlass aria-hidden="true" size={22} />
            <label className="dc-sr-only" htmlFor="hero-search">
              Tìm câu lạc bộ
            </label>
            <input
              id="hero-search"
              name="q"
              maxLength={100}
              placeholder="Bạn đang tìm cộng đồng nào?"
            />
            <button type="submit" aria-label="Tìm câu lạc bộ">
              <ArrowRight size={22} />
            </button>
          </form>
          <div className="dc-hero-links">
            <Link to="/clubs">
              Khám phá câu lạc bộ <ArrowUp />
            </Link>
            <Link to="/activities">Tìm một hoạt động</Link>
          </div>
        </div>
        <figure className="dc-hero-figure">
          <div className="dc-hero-image-frame">
            <ContentImage
              src="/images/guest/campus-bright-1000.jpg"
              alt="Ảnh minh họa sinh viên cùng học tập và kết nối"
              eager
            />
          </div>
          <figcaption>
            <span>Những cuộc gặp tạo nên cộng đồng.</span>
            <Link to="/clubs" aria-label="Khám phá cộng đồng Bách khoa">
              <ArrowRight size={25} />
            </Link>
          </figcaption>
        </figure>
      </section>
      <div className="dc-intro-strip">
        <div className="dc-container">
          <span>Mỗi đam mê, một nơi để bắt đầu.</span>
          <Link to="/clubs">
            Tìm CLB của bạn <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
      <section
        className="dc-container dc-section dc-preview-section dc-activities-section"
        aria-labelledby="home-activities"
      >
        <div className="dc-section-heading">
          <div>
            <h2 id="home-activities">
              {hasUpcoming ? "Hẹn bạn ở hoạt động tới" : "Dấu chân cộng đồng"}
            </h2>
            <p>
              {hasUpcoming
                ? "Một buổi gặp mới, một trải nghiệm đáng nhớ."
                : "Khám phá những hoạt động đã và đang kết nối sinh viên."}
            </p>
          </div>
          <Link className="dc-button dc-section-link" to="/activities">
            Tất cả hoạt động <ArrowUp />
          </Link>
        </div>
        {activities.data?.items.length ? (
          <ContentCards
            kind="activities"
            items={
              hasUpcoming
                ? activities.data.items
                : preview(activities.data.items)
            }
          />
        ) : (
          <QueryState
            {...activities}
            empty="Chưa có hoạt động công khai. Hẹn bạn khi lịch mới được cập nhật."
          />
        )}
      </section>
      <section className="dc-clubs-section dc-preview-section">
        <div className="dc-container dc-section">
          <div className="dc-section-heading">
            <div>
              <h2>Cùng tần số, cùng đam mê.</h2>
              <p>Từ một sở thích nhỏ đến một hành trình cùng nhau.</p>
            </div>
            <Link className="dc-button dc-section-link" to="/clubs">
              Khám phá các CLB <ArrowUp />
            </Link>
          </div>
          {clubs.data?.items.length ? (
            <ContentCards kind="clubs" items={preview(clubs.data.items)} />
          ) : (
            <QueryState
              {...clubs}
              empty="Chưa có câu lạc bộ được công khai. Bạn có thể quay lại sau để khám phá."
            />
          )}
        </div>
      </section>
      <section className="dc-container dc-section">
        <div className="dc-section-heading">
          <div>
            <h2>Chuyện kể từ các CLB</h2>
            <p>Góc nhìn, ý tưởng và những điều muốn chia sẻ.</p>
          </div>
          <Link className="dc-button dc-section-link" to="/posts">
            Xem tất cả bài viết <ArrowUp />
          </Link>
        </div>
        {posts.data?.items.length ? (
          <ContentCards kind="posts" items={posts.data.items} landing />
        ) : (
          <QueryState
            {...posts}
            empty="Chưa có bài viết công khai từ các CLB."
          />
        )}
      </section>
      <section className="dc-container dc-closing">
        <h2>
          Câu chuyện tiếp theo
          <br />
          có thể bắt đầu từ bạn.
        </h2>
        <div>
          <p>
            Đến với một cộng đồng. Thử một điều mới. Tìm thêm một phần của chính
            mình.
          </p>
          <Link className="dc-button" to="/clubs">
            Bắt đầu khám phá <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
function ArrowUp() {
  return <ArrowRight aria-hidden="true" size={18} />;
}
