import { describe, expect, it, vi } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { HeadingRedirect } from "../src/emitter";
import { assertFullSlug, createCtx, createProcessedContent } from "./helpers";

vi.mock("../src/redirect-links.inline", () => ({ default: "/* browser script */" }));

describe("HeadingRedirect", () => {
  it.each([
    { serve: false, baseDir: "", prefix: "/quartz" },
    { serve: true, baseDir: "", prefix: "" },
    { serve: true, baseDir: "/quartz", prefix: "/quartz" },
    { serve: true, baseDir: "quartz/", prefix: "/quartz" },
  ])("emits redirects for $serve / $baseDir", async ({ serve, baseDir, prefix }) => {
    const output = await fs.mkdtemp(path.join(tmpdir(), "heading-redirect-"));
    try {
      const ctx = createCtx({ argv: { output, serve } });
      Object.assign(ctx.argv, { baseDir });
      ctx.cfg.configuration = { baseUrl: "nzmsn.github.io/quartz" } as typeof ctx.cfg.configuration;
      const emitter = HeadingRedirect();
      await emitter.emit(
        ctx,
        [
          createProcessedContent({
            slug: assertFullSlug("超大陸"),
            frontmatter: { title: "超大陸", redirect: "古原生代#超大陸" },
          }),
        ],
        { css: [], js: [], additionalHead: [] },
      );
      const target = `${prefix}/${encodeURIComponent("古原生代")}#${encodeURIComponent("超大陸")}`;
      expect(
        JSON.parse(await fs.readFile(path.join(output, "heading-redirects.json"), "utf8")),
      ).toEqual({ 超大陸: target });
      expect(await fs.readFile(path.join(output, "超大陸.html"), "utf8")).toContain(target);
      const resource = emitter.externalResources?.(ctx)?.js?.[0];
      expect(resource?.contentType).toBe("inline");
      if (resource?.contentType === "inline") expect(resource.script).toContain("browser script");
    } finally {
      await fs.rm(output, { recursive: true, force: true });
    }
  });
});
