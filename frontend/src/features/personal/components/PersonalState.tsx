import { Link } from "react-router-dom";
export function PersonalState({
  loading,
  error,
  retry,
  empty,
}: {
  loading?: boolean;
  error?: string;
  retry?: () => void;
  empty?: string;
}) {
  return (
    <div className="ps-state">
      {loading ? (
        <p role="status">Đang tải không gian của bạn…</p>
      ) : error ? (
        <>
          <p role="alert">{error}</p>
          <button onClick={retry}>Thử lại</button>
        </>
      ) : (
        <>
          <p>{empty}</p>
          <Link to="/clubs">Khám phá cộng đồng →</Link>
        </>
      )}
    </div>
  );
}
