import { describe, expect, it } from "vitest";
import { unified } from "unified";
import { VFile } from "vfile";
import type { Root, Element } from "hast";
import { HeadingRedirectTransformer } from "../src/transformer";
import { createCtx } from "./helpers";

describe("HeadingRedirectTransformer", () => {
  it.each([true, false])("only marks links on redirect pages: %s", async (redirect) => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "a",
          properties: { href: "/古原生代" },
          children: [],
        },
      ],
    };
    const file = new VFile();
    file.data.frontmatter = { title: "Test", ...(redirect ? { redirect: "古原生代#超大陸" } : {}) };
    const plugins = HeadingRedirectTransformer().htmlPlugins?.(createCtx()) ?? [];
    await unified().use(plugins).run(tree, file);
    expect((tree.children[0] as Element).properties.dataRouterIgnore).toBe(
      redirect ? true : undefined,
    );
  });
});
