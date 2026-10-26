import type {
  QuartzComponent,
  QuartzComponentProps,
  QuartzComponentConstructor,
} from "@quartz-community/types";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment, jsx, jsxs } from "preact/jsx-runtime";
import style from "./styles/example.scss";


export default (() => {
  const Component: QuartzComponent = (props: QuartzComponentProps) => {
    const sitemap = props.allFiles.find(
      (file) => file.slug === "サイトマップ"
    );

    if (!sitemap?.htmlAst) {
      return null;
    }

    const content = toJsxRuntime(sitemap.htmlAst, {
      Fragment,
      jsx,
      jsxs,
    });

return (
  <>
    <div class="sitemap-sidebar sitemap-desktop">
      {content}
    </div>

    <details class="sitemap-mobile-menu">
      <summary class="sitemap-menu-button" aria-label="Open sitemap">
        ☰
      </summary>

      <div class="sitemap-menu-panel">
        {content}
      </div>
    </details>
  </>
);
  };

  Component.css = style;

  return Component;
}) satisfies QuartzComponentConstructor;