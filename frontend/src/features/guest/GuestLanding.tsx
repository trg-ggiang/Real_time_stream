import { BrowserRouter, Navigate, useLocation } from "react-router-dom";
import { DiscoveryApp, type DiscoveryViewer } from "../discovery/DiscoveryApp";
/** Compatibility hashes resolve to canonical routes within the same router. */
export function GuestLanding(props: DiscoveryViewer) {
  return (
    <BrowserRouter>
      <WorkspaceBridge {...props} />
    </BrowserRouter>
  );
}
function WorkspaceBridge(props: DiscoveryViewer) {
  const location = useLocation();
  if (location.hash === "#admin-clubs")
    return <Navigate replace to="/admin/club-requests" />;
  const match = location.hash.match(/^#my-clubs(?:\/([^/]+))?$/);
  if (match)
    return (
      <Navigate
        replace
        to={
          match[1] ? `/workspace/${encodeURIComponent(match[1])}` : "/workspace"
        }
      />
    );
  return <DiscoveryApp key={props.accessToken || "guest"} {...props} />;
}
