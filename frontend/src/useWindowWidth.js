import { useState, useEffect } from "react";

export function useWindowWidth() {
  // Start from a sane desktop default; the effect below re-syncs to the true
  // viewport width immediately after mount and on every change thereafter.
  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return 1200;
    const w = window.innerWidth;
    return w && w > 0 ? w : 1200;
  });

  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth || document.documentElement.clientWidth;
      if (w && w > 0) setWidth((prev) => (prev === w ? prev : w));
    };

    // Sync once on mount.
    measure();

    // The window 'resize' event is not always dispatched when the layout
    // viewport actually changes (embedded preview frames, some mobile browsers,
    // the fresh navigation returning from the Google OAuth redirect). When that
    // happens the width stays stale and the whole responsive layout locks to the
    // wrong breakpoint — desktop stuck in mobile, or a phone stuck in tablet.
    // A ResizeObserver on <html> fires an initial callback on observe() AND on
    // any real viewport size change, so it's the reliable source of truth. The
    // event listeners are kept as a belt-and-braces fallback.
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", measure);
    }

    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(document.documentElement);
    }

    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", measure);
      }
      if (ro) ro.disconnect();
    };
  }, []);

  return width;
}
