/* eslint-disable no-restricted-syntax -- These delegated handlers persist across SPA navigation; temporary scroll listeners clean themselves up. */
let redirectsPromise: Promise<Record<string, string>> | null = null;
let pendingTarget: URL | null = null;
let cancelScroll: (() => void) | undefined;

const basePath = () => document.body.dataset.basepath ?? "";
const getRedirects = () => {
  redirectsPromise ??= fetch(`${basePath()}/heading-redirects.json`)
    .then((response) => (response.ok ? (response.json() as Promise<Record<string, string>>) : {}))
    .catch(() => ({}));
  return redirectsPromise;
};

const findHeading = (hash: string) => {
  let id: string;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    return;
  }
  // Search previews can contain copies of the article's IDs.
  return Array.from(
    document.querySelectorAll<HTMLElement>(".center article :is(h1,h2,h3,h4,h5,h6)[id]"),
  ).find((heading) => heading.id === id);
};

const scheduleHeadingScroll = (url: URL) => {
  cancelScroll?.();
  if (!url.hash) return;
  let active = true;
  let frame = 0;
  const scroll = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (active && location.href === url.href) {
          findHeading(url.hash)?.scrollIntoView({ block: "start", behavior: "instant" });
        }
      });
    });
  };
  const viewport = window.visualViewport;
  const stop = () => {
    active = false;
    cancelAnimationFrame(frame);
    clearTimeout(timeout);
    viewport?.removeEventListener("resize", scroll);
    document.removeEventListener("load", scroll, true);
    for (const type of ["pointerdown", "touchstart", "wheel", "keydown"]) {
      document.removeEventListener(type, stop, true);
    }
  };
  // Re-align during keyboard dismissal, font loading and image layout changes.
  // Stop correcting as soon as the reader starts interacting.
  const timeout = setTimeout(stop, 1500);
  viewport?.addEventListener("resize", scroll);
  document.addEventListener("load", scroll, true);
  for (const type of ["pointerdown", "touchstart", "wheel", "keydown"]) {
    document.addEventListener(type, stop, { capture: true, passive: true });
  }
  void document.fonts?.ready.then(() => {
    if (active) scroll();
  });
  cancelScroll = stop;
  scroll();
};

const markRedirectLink = (link: HTMLAnchorElement, redirects: Record<string, string>) => {
  const url = new URL(link.href, location.href);
  const prefix = `${basePath()}/`;
  if (url.origin !== location.origin || !url.pathname.startsWith(prefix)) return;
  let slug: string;
  try {
    slug = decodeURIComponent(url.pathname.slice(prefix.length));
  } catch {
    return;
  }
  const target = redirects[slug];
  if (!target) return;
  link.href = target;
  link.dataset.headingRedirectMarked = "true";
  link.dataset.routerIgnore = "";
};

const markRedirectLinks = async () => {
  const redirects = await getRedirects();
  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    markRedirectLink(link, redirects);
  });
};

const observer = new MutationObserver((mutations) => {
  void getRedirects().then((redirects) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node instanceof HTMLAnchorElement) markRedirectLink(node, redirects);
        node.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
          markRedirectLink(link, redirects);
        });
      }
    }
  });
});
observer.observe(document.documentElement, { childList: true, subtree: true });

// Bubble after search closes its panel and blurs the input, before Quartz's
// window click handler. A single handler also survives SPA DOM replacement.
document.addEventListener("click", (event) => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey ||
    !(event.target instanceof Element)
  )
    return;
  const link = event.target.closest<HTMLAnchorElement>("a[data-heading-redirect-marked]");
  if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return;
  event.preventDefault();
  event.stopPropagation();
  cancelScroll?.();
  sessionStorage.removeItem("search-term");
  if (url.pathname === location.pathname && url.search === location.search && url.hash) {
    pendingTarget = null;
    if (location.href !== url.href) history.pushState({}, "", url);
    scheduleHeadingScroll(url);
  } else if (typeof window.spaNavigate === "function") {
    pendingTarget = url;
    void window.spaNavigate(url, false);
  } else {
    location.assign(url);
  }
});

document.addEventListener("prenav", () => cancelScroll?.());
document.addEventListener("nav", () => {
  void markRedirectLinks();
  if (pendingTarget && pendingTarget.href === location.href) {
    const url = pendingTarget;
    pendingTarget = null;
    scheduleHeadingScroll(url);
  } else {
    pendingTarget = null;
    // Also covers a direct visit through the emitted redirect HTML.
    scheduleHeadingScroll(new URL(location.href));
  }
});
void markRedirectLinks();
