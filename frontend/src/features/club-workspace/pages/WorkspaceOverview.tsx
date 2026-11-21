import { Link } from "react-router-dom";
import { useClub } from "../workspace-context";
import { usePersonalQuery } from "../../personal/use-personal-query";
import { PersonalState } from "../../personal/components/PersonalState";
import type { ContentItem, WorkspaceList } from "../services/workspace-api";
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { CalendarBlank } from '@phosphor-icons/react/dist/csr/CalendarBlank';
import { Article } from '@phosphor-icons/react/dist/csr/Article';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { NotePencil } from '@phosphor-icons/react/dist/csr/NotePencil';
import { CheckSquare } from '@phosphor-icons/react/dist/csr/CheckSquare';

export function WorkspaceOverview() {
  const { club, clubId, membership, token } = useClub();
  const chair = membership.role === "chairperson";
  const posts = usePersonalQuery<WorkspaceList<ContentItem>>(token, `workspace/${clubId}/content/posts?list=published&page=1&limit=3`);
  const members = usePersonalQuery<WorkspaceList<unknown>>(token, `workspace/${clubId}/members?page=1&limit=1`);
  const activities = usePersonalQuery<WorkspaceList<ContentItem>>(token, `workspace/${clubId}/content/activities?list=published&page=1&limit=3`);
  const base = `/workspace/${clubId}`;
  return <div className="cw-overview">
    <header className="cw-overview-hero"><div className="cw-overview-welcome"><span className="cw-role-label">{chair ? 'Không gian chủ nhiệm' : membership.role === 'head' ? 'Không gian trưởng ban' : 'Không gian thành viên'}</span><h1>{club.name}</h1><p>{club.summary || 'Nơi các thành viên cùng trao đổi, lên kế hoạch và tạo nên những hoạt động đáng nhớ.'}</p><div className="cw-overview-hero-actions"><Link className="cw-primary" to={`${base}/posts/new`}><NotePencil size={18} aria-hidden="true" />Viết bài</Link><Link className="cw-overview-meeting-link" to={`${base}/meetings`}><CalendarBlank size={18} aria-hidden="true" />Phòng họp</Link></div></div><div className="cw-overview-mark" aria-hidden="true">{club.name.trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join('')}</div></header>
    <div className="cw-overview-stats" aria-label="Thông tin tổng quan">
      <Link to={`${base}/members`}><UsersThree size={22} aria-hidden="true" /><span><strong>{members.data?.total ?? '…'}</strong><small>Thành viên</small></span><ArrowUpRight size={16} aria-hidden="true" /></Link>
      <Link to={`${base}/posts`}><Article size={22} aria-hidden="true" /><span><strong>{posts.data?.total ?? '…'}</strong><small>Bài đã đăng</small></span><ArrowUpRight size={16} aria-hidden="true" /></Link>
      <Link to={`${base}/activities`}><CalendarBlank size={22} aria-hidden="true" /><span><strong>{activities.data?.total ?? '…'}</strong><small>Hoạt động</small></span><ArrowUpRight size={16} aria-hidden="true" /></Link>
    </div>
    <div className="cw-overview-columns">
      <section className="cw-overview-feed" aria-labelledby="club-feed"><div className="cw-overview-heading"><div><h2 id="club-feed">Bảng tin mới nhất</h2><p>Cập nhật từ các thành viên trong CLB.</p></div><Link to={`${base}/posts`}>Xem tất cả <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
        {posts.data?.items.length ? <div className="cw-overview-posts">{posts.data.items.map(post => <Link key={post.post_id} to={`${base}/posts/${post.post_id}`}><span><strong>{post.title}</strong><small>{post.visibility === "internal" ? "Nội bộ CLB" : "Công khai"}</small></span><span aria-hidden="true">→</span></Link>)}</div> : <PersonalState {...posts} empty="Chưa có bài viết nào được đăng. Hãy bắt đầu bằng một bài mới." />}
      </section>
      <aside className="cw-overview-quick"><h2>Thao tác nhanh</h2><p>Tiếp tục công việc của bạn.</p><Link to={`${base}/posts/new`}><NotePencil size={19} aria-hidden="true" /><span>Viết bài<small>Chia sẻ với CLB</small></span><ArrowUpRight size={15} aria-hidden="true" /></Link><Link to={`${base}/recurring-meetings`}><CalendarBlank size={19} aria-hidden="true" /><span>Tạo họp định kỳ<small>Giữ nhịp sinh hoạt chung</small></span><ArrowUpRight size={15} aria-hidden="true" /></Link>{chair && <Link to={`${base}/review`}><CheckSquare size={19} aria-hidden="true" /><span>Duyệt nội dung<small>Xem đề xuất từ thành viên</small></span><ArrowUpRight size={15} aria-hidden="true" /></Link>}<Link to={`${base}/members`}><UsersThree size={19} aria-hidden="true" /><span>Xem thành viên<small>Kết nối các ban</small></span><ArrowUpRight size={15} aria-hidden="true" /></Link></aside>
    </div>
  </div>;
}
