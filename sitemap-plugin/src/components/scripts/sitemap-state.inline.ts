const selector = ".sitemap-desktop details, .sitemap-menu-panel details";
const getDetails = () => document.querySelectorAll<HTMLDetailsElement>(selector);

let openStates: boolean[] = [];
let firstNavigation = true;

document.addEventListener("prenav", () => {
  openStates = Array.from(getDetails(), (details) => details.open);
});

document.addEventListener("nav", () => {
  const initialNavigation = firstNavigation;
  firstNavigation = false;
  getDetails().forEach((details, index) => {
    const open = openStates[index];
    if (open !== undefined) details.open = open;
  });

  const header = document.querySelector<HTMLElement>(".mobile-site-header");
  if (!header) return;
  const menus = Array.from(header.querySelectorAll<HTMLDetailsElement>(":scope > details"));
  const closeMenus = () =>
    menus.forEach((menu) => {
      menu.open = false;
    });
  // Move the existing nodes, preserving the search/theme listeners and settings.
  const tools = header.querySelector<HTMLElement>(".mobile-header-tools");
  const toolbar = Array.from(
    document.querySelectorAll<HTMLElement>(".left.sidebar > .flex-component"),
  ).find((element) => element.querySelector(".search-button, .darkmode"));
  const placeholder = document.createComment("desktop toolbar");
  const mobile = window.matchMedia("(max-width: 800px)");
  if (toolbar && tools) toolbar.before(placeholder);
  const updateOffset = () => {
    const height = header.getBoundingClientRect().height;
    if (mobile.matches && height > 0) {
      document.documentElement.style.setProperty("--mobile-header-offset", `${height}px`);
    } else {
      document.documentElement.style.removeProperty("--mobile-header-offset");
    }
  };
  const syncToolbar = () => {
    if (toolbar && tools) {
      if (mobile.matches) tools.append(toolbar);
      else placeholder.after(toolbar);
    }
    closeMenus();
    updateOffset();
  };
  syncToolbar();
  mobile.addEventListener("change", syncToolbar);
  const sizeObserver = new ResizeObserver(updateOffset);
  sizeObserver.observe(header);

  // Initial fragments can be resolved before the header's first measurement.
  // Normal TOC and heading-redirect scrollIntoView calls use the CSS scroll padding.
  const fragmentFrame = requestAnimationFrame(() => {
    if (!mobile.matches || !location.hash) return;
    let id: string;
    try {
      id = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    const target = document.getElementById(id);
    if (!target?.matches("article h1, article h2, article h3, article h4, article h5, article h6"))
      return;
    const top = target.getBoundingClientRect().top;
    const offset = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
    if (top >= 0 && top < offset) target.scrollIntoView({ block: "start", behavior: "instant" });
  });
  // On a full page load the browser can resolve the fragment before fonts and
  // the toolbar settle. Align once after both are ready, unless the user has
  // already started interacting. Never override back/forward scroll restoration.
  const initialHash = location.hash;
  let disposed = false;
  let interacted = false;
  const onInteraction = () => {
    interacted = true;
  };
  const interactionEvents = ["pointerdown", "wheel", "touchstart", "keydown"] as const;
  const stopTrackingInteraction = () =>
    interactionEvents.forEach((type) => document.removeEventListener(type, onInteraction, true));
  let onLoad: (() => void) | undefined;
  const navigation = performance.getEntriesByType("navigation")[0] as
    PerformanceNavigationTiming | undefined;
  if (initialNavigation && initialHash && navigation?.type !== "back_forward") {
    interactionEvents.forEach((type) =>
      document.addEventListener(type, onInteraction, { capture: true, passive: true }),
    );
    const loaded =
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            onLoad = resolve;
            window.addEventListener("load", onLoad, { once: true });
          });
    void Promise.all([loaded, document.fonts?.ready]).then(() => {
      stopTrackingInteraction();
      if (disposed || interacted || !mobile.matches || location.hash !== initialHash) return;
      let id: string;
      try {
        id = decodeURIComponent(initialHash.slice(1));
      } catch {
        return;
      }
      const target = document.getElementById(id);
      if (
        target?.matches("article h1, article h2, article h3, article h4, article h5, article h6")
      ) {
        updateOffset();
        target.scrollIntoView({ block: "start", behavior: "instant" });
      }
    });
  }
  const searchContainer = toolbar?.querySelector(".search-container");
  const searchObserver = new MutationObserver(() => {
    if (searchContainer?.classList.contains("active")) closeMenus();
  });
  if (searchContainer)
    searchObserver.observe(searchContainer, { attributes: true, attributeFilter: ["class"] });
  const onToggle = (event: Event) => {
    const current = event.target as HTMLDetailsElement;
    if (current.open)
      menus.forEach((menu) => {
        if (menu !== current) menu.open = false;
      });
  };
  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!header.contains(target) || target.closest("a, .search-button")) closeMenus();
  };
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    const open = menus.find((menu) => menu.open);
    closeMenus();
    open?.querySelector<HTMLElement>("summary")?.focus();
  };
  menus.forEach((menu) => menu.addEventListener("toggle", onToggle));
  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeydown);
  window.addCleanup(() => {
    disposed = true;
    stopTrackingInteraction();
    if (onLoad) window.removeEventListener("load", onLoad);
    mobile.removeEventListener("change", syncToolbar);
    sizeObserver.disconnect();
    searchObserver.disconnect();
    cancelAnimationFrame(fragmentFrame);
    if (toolbar && tools) placeholder.replaceWith(toolbar);
    document.documentElement.style.removeProperty("--mobile-header-offset");
    menus.forEach((menu) => menu.removeEventListener("toggle", onToggle));
    document.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKeydown);
  });
});

export default "";
