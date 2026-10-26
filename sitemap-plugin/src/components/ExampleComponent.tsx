import type {
  QuartzComponent,
  QuartzComponentProps,
  QuartzComponentConstructor,
} from "@quartz-community/types";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment, jsx, jsxs } from "preact/jsx-runtime";

export default (() => {
  const Component: QuartzComponent = (props: QuartzComponentProps) => {
    const sitemap = props.allFiles.find(
      (file) => file.slug === "サイトマップ"
    );

    if (!sitemap?.htmlAst) {
      return (
        <div class="sitemap-sidebar">
          <h3>サイトマップ</h3>
          <p>サイトマップ.md が見つかりません。</p>
        </div>
      );
    }

    const content = toJsxRuntime(sitemap.htmlAst, {
      Fragment,
      jsx,
      jsxs,
    });

    return (
      <div class="sitemap-sidebar">
        {content}
      </div>
    );
  };

  return Component;
}) satisfies QuartzComponentConstructor;