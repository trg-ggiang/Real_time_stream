import { useEffect, useState } from "react";
import {
  getCollection,
  getDetail,
  type Collection,
  type PublicItem,
  type PublicPage,
} from "../services/discovery-api";
import { PublicApiError } from "../../../shared/api/public-http";

function useQuery<T>(
  key: string,
  request: (signal: AbortSignal) => Promise<T>,
) {
  const [result, setResult] = useState<{
    key: string;
    data?: T;
    error?: string;
    notFound?: boolean;
  }>({ key });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult({ key });
    void request(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            error:
              error instanceof Error
                ? error.message
                : "Không tải được nội dung.",
            notFound: error instanceof PublicApiError && error.status === 404,
          });
      });
    return () => controller.abort();
    // key is the complete request identity; callers build it from scalar inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  const current = result.key === key ? result : { key };
  return {
    data: current.data,
    error: current.error,
    notFound: current.notFound,
    loading: !current.data && !current.error,
    retry: () => setAttempt((n) => n + 1),
  };
}
export function useCollection(kind: Collection, params = "page=1&limit=6") {
  return useQuery<PublicPage>(`${kind}?${params}`, (signal) =>
    getCollection(kind, params, signal),
  );
}
export function usePublicDetail(kind: Collection, id: string) {
  return useQuery<PublicItem>(`${kind}/${id}`, (signal) =>
    getDetail(kind, id, signal),
  );
}
