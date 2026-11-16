import { useEffect } from "react";
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    const beforeNavigate = (event: Event) => {
      if (
        dirty &&
        !window.confirm(
          "Bạn có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?",
        )
      )
        event.preventDefault();
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const click = (event: MouseEvent) => {
      if (!dirty || event.defaultPrevented || event.button !== 0) return;
      const link = (event.target as Element)?.closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      const leavingAccount = (event.target as Element)?.closest(
        "[data-leave-account]",
      );
      if (
        ((link && link.href !== window.location.href) || leavingAccount) &&
        !window.confirm(
          "Bạn có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("uc:before-navigate", beforeNavigate);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("uc:before-navigate", beforeNavigate);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
}
