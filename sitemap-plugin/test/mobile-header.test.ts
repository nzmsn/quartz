import { describe, expect, it } from "vitest";
import { h } from "preact";
import { render } from "preact-render-to-string";
import type { QuartzComponentProps } from "@quartz-community/types";
import { ExampleComponent } from "../dist/components/index.js";

const Component = ExampleComponent();
function page(
  toc?: { slug: string; text: string; depth: number }[],
  slug = "index",
  sidebar = true,
) {
  return render(
    h(Component, {
      cfg: { pageTitle: "私のWiki" },
      fileData: { slug, toc },
      allFiles: sidebar
        ? [
            {
              slug: "sidebar",
              htmlAst: { type: "root", children: [{ type: "text", value: "本棚の内容" }] },
            },
          ]
        : [],
    } as unknown as QuartzComponentProps),
  );
}

describe("mobile site header", () => {
  it("keeps the same bookshelf content on desktop and mobile", () => {
    const html = page();
    expect(html.match(/本棚の内容/g)).toHaveLength(2);
    expect(html).toContain('class="sitemap-menu-button">本棚');
  });
  it("omits the TOC button when no entries exist", () => {
    expect(page()).not.toContain('class="mobile-toc-menu"');
    expect(page([])).not.toContain('class="mobile-toc-menu"');
  });
  it("renders even a single TOC entry with its real anchor and nesting", () => {
    const html = page([{ slug: "見出し", text: "見出し", depth: 2 }]);
    expect(html).toContain('class="mobile-toc-menu"');
    expect(html).toContain('href="#見出し" data-for="見出し"');
    expect(html).toContain("padding-inline-start:2rem");
  });
  it("links home relative to both root and deeply nested pages", () => {
    expect(page()).toContain('class="mobile-site-home" href="./"');
    expect(page([], "folder/nested/page")).toContain('class="mobile-site-home" href="../..\/"');
  });
  it("keeps the home and TOC controls on pages without a bookshelf file", () => {
    const html = page([{ slug: "a", text: "A", depth: 0 }], "index", false);
    expect(html).toContain('class="mobile-site-home"');
    expect(html).toContain('class="mobile-toc-menu"');
    expect(html).not.toContain('class="sitemap-mobile-menu"');
  });
  it("provides a toolbar mount and preserves the full home title for narrow screens", () => {
    const html = page();
    expect(html).toContain('class="mobile-header-tools"');
    expect(html).toContain('title="私のWiki"');
    expect(html).toContain("<span>私のWiki</span>");
  });
});
