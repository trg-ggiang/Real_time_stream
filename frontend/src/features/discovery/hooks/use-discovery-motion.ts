import { useEffect, type RefObject } from "react";

/** Progressive enhancement: content remains visible without observers or motion. */
export function useDiscoveryMotion(
  root: RefObject<HTMLElement | null>,
  route: string,
) {
  useEffect(() => {
    const element = root.current;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!element || reduced?.matches) return;

    const observed = new WeakSet<Element>();
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const entry of entries)
                if (entry.isIntersecting) {
                  entry.target.classList.add("dc-revealed");
                  observer?.unobserve(entry.target);
                }
            },
            { threshold: 0.12, rootMargin: "0px 0px -24px 0px" },
          );
    const observe = () => {
      element
        .querySelectorAll(
          ".dc-section-heading, .dc-club-card, .dc-event, .dc-post, .dc-closing",
        )
        .forEach((target) => {
          if (!observed.has(target)) {
            observed.add(target);
            observer?.observe(target);
          }
        });
    };
    observe();
    const mutation = new MutationObserver(observe);
    mutation.observe(element, { childList: true, subtree: true });

    let frame = 0;
    const update = () => {
      frame = 0;
      const hero = element.querySelector<HTMLElement>(".dc-hero-figure");
      if (!hero || reduced?.matches || window.innerWidth < 801) return;
      const box = hero.getBoundingClientRect();
      const drift = Math.max(
        -14,
        Math.min(
          14,
          (window.innerHeight * 0.35 - box.top - box.height * 0.3) * 0.045,
        ),
      );
      hero.style.setProperty("--dc-photo-drift", `${drift.toFixed(1)}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      observer?.disconnect();
      mutation.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [root, route]);
}
