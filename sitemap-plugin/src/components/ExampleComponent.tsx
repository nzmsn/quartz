import type {
  QuartzComponent,
  QuartzComponentProps,
  QuartzComponentConstructor,
} from "@quartz-community/types";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment, jsx, jsxs } from "preact/jsx-runtime";
import style from "./styles/example.scss";
import sitemapState from "./scripts/sitemap-state.inline";
import { pathToRoot } from "@quartz-community/utils";

export default (() => {
  const Component: QuartzComponent = (props: QuartzComponentProps) => {
    const sitemap = props.allFiles.find((file) => file.slug === "sidebar");

    const content = sitemap?.htmlAst
      ? toJsxRuntime(sitemap.htmlAst, {
          Fragment,
          jsx,
          jsxs,
        })
      : null;
    const toc =
      (props.fileData as { toc?: { slug: string; text: string; depth: number }[] }).toc ?? [];

    return (
      <>
        <div class="sitemap-sidebar sitemap-desktop">{content}</div>

        <nav class="mobile-site-header" aria-label="サイトナビゲーション">
          {content && (
            <details class="sitemap-mobile-menu">
              <summary class="sitemap-menu-button">本棚</summary>

              <div class="sitemap-menu-panel">{content}</div>
            </details>
          )}
          {toc.length > 0 && (
            <details class="mobile-toc-menu">
              <summary class="sitemap-menu-button">目次</summary>
              <div class="sitemap-menu-panel mobile-toc-panel">
                <ul>
                  {toc.map(({ slug, text, depth }) => (
                    <li key={slug} style={{ paddingInlineStart: `${depth}rem` }}>
                      <a href={`#${slug}`} data-for={slug}>
                        {text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )}
          <a
            class="mobile-site-home"
            href={`${pathToRoot(props.fileData.slug!)}/`}
            title="ホーム"
            aria-label="ホームへ戻る"
          >
            <span aria-hidden="true">🏠</span>
          </a>
          <div class="mobile-header-tools" />
        </nav>
      </>
    );
  };

  Component.css = style;
  Component.afterDOMLoaded = sitemapState;

  return Component;
}) satisfies QuartzComponentConstructor;
