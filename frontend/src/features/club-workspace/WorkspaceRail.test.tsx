// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { WorkspaceRail } from './WorkspaceRail';

it('shows a count for each club that needs attention', () => {
  render(<MemoryRouter><WorkspaceRail clubs={[{ id: 'club-a', name: 'CLB A' }, { id: 'club-b', name: 'CLB B' }]}
    attention={{ 'club-a': { channels: [{ channel_id: 'channel', unread: 2 }], meetings: 1, review: 0,
      revisions: 0, postRevisions: 0, activityRevisions: 0, total: 3 } }} /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Mở CLB A, 3 thông báo' }).textContent).toContain('3');
  expect(screen.getByRole('link', { name: 'Mở CLB B' }).textContent).not.toContain('3');
});
