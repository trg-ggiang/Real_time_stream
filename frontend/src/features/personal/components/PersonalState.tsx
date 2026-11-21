import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Tray } from "@phosphor-icons/react/dist/csr/Tray";

export function PersonalEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="ps-empty">
      <Tray size={64} weight="duotone" aria-hidden="true" />
      {children}
    </div>
  );
}
export function PersonalState({
  loading,
  error,
  retry,
  empty,
  showDiscoveryLink = true,
}: {
  loading?: boolean;
  error?: string;
  retry?: () => void;
  empty?: string;
  showDiscoveryLink?: boolean;
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
        <PersonalEmpty>
          <p>{empty}</p>
          {showDiscoveryLink && <Link className="ps-primary" to="/clubs">Khám phá cộng đồng →</Link>}
        </PersonalEmpty>
      )}
    </div>
  );
}
