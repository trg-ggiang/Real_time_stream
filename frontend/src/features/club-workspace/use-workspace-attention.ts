import { useEffect, useState } from 'react';
import { workspaceRequest, type WorkspaceAttention } from './services/workspace-api';

export function useWorkspaceAttention(token: string, clubIds: string[]) {
  const ids = clubIds.join(',');
  const [summaries, setSummaries] = useState<Record<string, WorkspaceAttention>>({});
  useEffect(() => {
    if (!token || !ids) { setSummaries({}); return; }
    const controller = new AbortController();
    const clubs = ids.split(',');
    async function refresh() {
      const today = new Date();
      const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const dayQuery = `attention?dayStart=${encodeURIComponent(dayStart.toISOString())}&dayEnd=${encodeURIComponent(dayEnd.toISOString())}`;
      const results = await Promise.allSettled(clubs.map(async clubId => ({
        clubId, value: await workspaceRequest<WorkspaceAttention>(token, clubId, dayQuery, { signal: controller.signal }),
      })));
      if (controller.signal.aborted) return;
      setSummaries(previous => {
        const next: Record<string, WorkspaceAttention> = {};
        for (const result of results) if (result.status === 'fulfilled') next[result.value.clubId] = result.value.value;
        for (const clubId of clubs) if (!next[clubId] && previous[clubId]) next[clubId] = previous[clubId];
        return next;
      });
    }
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    const changed = () => { void refresh(); };
    window.addEventListener('uc:workspace-attention-changed', changed);
    window.addEventListener('focus', changed);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('uc:workspace-attention-changed', changed); window.removeEventListener('focus', changed); };
  }, [token, ids]);
  return summaries;
}
