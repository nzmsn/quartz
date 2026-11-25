import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { QuartzEmitterPluginInstance } from "../plugins/types"
import type { BuildCtx } from "./ctx"
import type { ProcessedContent } from "../plugins/vfile"

export function readYomi(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value])
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
}

// Enrich only entries the standard emitter has already made public.
export async function appendYomi(ctx: BuildCtx, content: ProcessedContent[]): Promise<void> {
  const target = path.join(ctx.argv.output, "static", "contentIndex.json")
  const index = JSON.parse(await readFile(target, "utf8")) as Record<string, { yomi?: string[] }>
  for (const [, file] of content) {
    const data = file.data
    const slug = data.slug
    if (!slug || !Object.hasOwn(index, slug)) continue
    if (data.unlisted === true || data.encrypted === true) continue
    const readings = readYomi(data.frontmatter?.yomi)
    if (readings.length > 0) index[slug].yomi = readings
  }
  await writeFile(target, JSON.stringify(index), "utf8")
}

export function withYomiContentIndex(
  base: QuartzEmitterPluginInstance,
): QuartzEmitterPluginInstance {
  return {
    ...base,
    async *emit(ctx, content, resources) {
      const outputs = await base.emit(ctx, content, resources)
      const files = []
      for await (const file of outputs) files.push(file)
      await appendYomi(ctx, content)
      yield* files
    },
    partialEmit: base.partialEmit
      ? async function* (ctx, content, resources, changes) {
          const outputs = await base.partialEmit!(ctx, content, resources, changes)
          if (!outputs) return
          const files = []
          for await (const file of outputs) files.push(file)
          await appendYomi(ctx, content)
          yield* files
        }
      : undefined,
  }
}
