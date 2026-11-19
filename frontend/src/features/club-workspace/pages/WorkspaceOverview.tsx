import { Link } from "react-router-dom";
import { useClub } from "../workspace-context";
import { usePersonalQuery } from "../../personal/use-personal-query";
import { PersonalState } from "../../personal/components/PersonalState";
import type { ContentItem, WorkspaceList } from "../services/workspace-api";

export function WorkspaceOverview() {
  const { club, clubId, membership, token } = useClub();
  const chair = membership.role === "chairperson";
  const posts = usePersonalQuery<WorkspaceList<ContentItem>>(token, `workspace/${clubId}/content/posts?list=published&page=1&limit=3`);
  const base = `/workspace/${clubId}`;
  return <div className="cw-overview">
    <header className="cw-overview-hero"><span className="cw-eyebrow">{chair ? "Không gian chủ nhiệm" : "Không gian thành viên"}</span><h1>{club.name}</h1><p>{club.summary || "Cùng theo dõi câu chuyện và hoạt động của CLB."}</p><div className="cw-overview-hero-actions"><Link to={`${base}/posts/new`}>Viết bài mới →</Link><Link to={`${base}/activities`}>Xem hoạt động →</Link></div></header>
    <div className="cw-overview-columns">
      <section className="cw-overview-feed" aria-labelledby="club-feed"><div className="cw-overview-heading"><div><span className="cw-eyebrow">Mới trong CLB</span><h2 id="club-feed">Bảng tin</h2></div><Link to={`${base}/posts`}>Tất cả bài viết →</Link></div>
        {posts.data?.items.length ? <div className="cw-overview-posts">{posts.data.items.map(post => <Link key={post.post_id} to={`${base}/posts/${post.post_id}`}><span><strong>{post.title}</strong><small>{post.visibility === "internal" ? "Nội bộ CLB" : "Công khai"}</small></span><span aria-hidden="true">→</span></Link>)}</div> : <PersonalState {...posts} empty="Chưa có bài viết nào được đăng. Hãy bắt đầu bằng một bài mới." />}
      </section>
      <aside className="cw-overview-quick"><span className="cw-eyebrow">Đi tiếp</span><h2>Việc trong CLB</h2><Link to={`${base}/posts/new`}>Viết bài <span aria-hidden="true">→</span></Link><Link to={`${base}/activities`}>Xem hoạt động <span aria-hidden="true">→</span></Link><Link to={`${base}/recurring-meetings`}>Tạo họp định kỳ <span aria-hidden="true">→</span></Link>{chair && <Link to={`${base}/review`}>Duyệt nội dung <span aria-hidden="true">→</span></Link>}<Link to={`${base}/members`}>Xem thành viên <span aria-hidden="true">→</span></Link></aside>
    </div>
  </div>;
}
