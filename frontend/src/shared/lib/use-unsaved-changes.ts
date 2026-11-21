import { useEffect } from "react";
import { confirmAction } from './confirm-action';
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    let active = true, bypass = false, asking = false;
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const click = (event: MouseEvent) => {
      if (bypass) { bypass = false; return; }
      if (!dirty || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element)?.closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (link?.target === '_blank' || link?.hasAttribute('download')) return;
      const leavingAccount = (event.target as Element)?.closest(
        "[data-leave-account]",
      );
      const destination = link && link.href !== window.location.href ? link : leavingAccount;
      if (destination instanceof HTMLElement) {
        event.preventDefault();
        event.stopPropagation();
        if (asking) return;
        asking = true;
        void confirmAction('Bạn có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?').then(accepted => {
          asking = false;
          if (active && accepted && destination.isConnected) { bypass = true; destination.click(); }
        });
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      active = false;
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
}
