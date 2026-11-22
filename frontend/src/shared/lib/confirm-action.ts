import './confirm-action.css';

let showing = false;

/** User-facing confirmation; text stays plain and no action runs before acceptance. */
export function confirmAction(message: string, danger = false): Promise<boolean> {
  if (showing) return Promise.resolve(false);
  showing = true;
  return new Promise(resolve => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = document.createElement('dialog');
    dialog.className = 'uc-confirm';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'uc-confirm-title');
    const scope = previous?.closest('[data-theme]');
    dialog.dataset.theme = scope?.getAttribute('data-theme') || 'light';
    const title = document.createElement('h2');
    title.id = 'uc-confirm-title'; title.textContent = message;
    const actions = document.createElement('div'); actions.className = 'uc-confirm-actions';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Hủy';
    const accept = document.createElement('button'); accept.type = 'button'; accept.textContent = 'Xác nhận'; accept.className = 'uc-confirm-accept';
    if (danger) accept.dataset.danger = 'true';
    actions.append(cancel, accept); dialog.append(title, actions);
    let settled = false;
    const finish = (accepted: boolean) => {
      if (settled) return;
      settled = true; dialog.remove(); showing = false;
      window.removeEventListener('popstate', cancelNavigation);
      if (previous?.isConnected) previous.focus();
      resolve(accepted);
    };
    const cancelNavigation = () => finish(false);
    cancel.onclick = () => finish(false);
    accept.onclick = () => finish(true);
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
    dialog.addEventListener('close', () => finish(false));
    window.addEventListener('popstate', cancelNavigation);
    document.body.append(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    cancel.focus();
  });
}
