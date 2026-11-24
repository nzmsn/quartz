import { test, expect, type Page } from "@playwright/test"
import { build } from "esbuild"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "../..")
const target = `/quartz/${encodeURIComponent("古原生代")}#${encodeURIComponent("超大陸")}`
let scripts: Record<string, string>

test.beforeAll(async () => {
  scripts = {}
  for (const [name, entry] of Object.entries({
    search: "search-plugin/src/components/scripts/search.inline.ts",
    redirect: "heading-redirect-plugin/src/redirect-links.inline.ts",
    spa: "quartz/components/scripts/spa.inline.ts",
  })) {
    const result = await build({
      entryPoints: [path.join(root, entry)],
      bundle: true,
      write: false,
      platform: "browser",
      format: "iife",
      target: "es2022",
    })
    scripts[`/${name}.js`] = result.outputFiles![0]!.text
  }
})

const html = (
  slug: string,
) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${slug}</title>
<style data-persist>html{scroll-padding-top:64px}body{margin:0}.search-button{position:fixed;top:0;z-index:2}
.search-container{display:none;position:fixed;inset:30px 0 0;background:white;overflow:auto;z-index:3}
.search-container.active{display:block}.result-card{display:block;padding:20px}.preview-container{height:200px;overflow:auto}
.before{height:1800px}.after{height:2000px}h3{margin:0;height:50px}article{padding-top:100px}</style>
<script data-persist>var fetchData=Promise.resolve({
"超大陸":{title:"超大陸",content:"超大陸について",tags:[],links:[]},
"通常項目":{title:"通常項目",content:"通常検索語について",tags:[],links:[]}});</script>
</head><body data-basepath="/quartz" data-slug="${slug}">
<div class="sidebar"><div class="search"><button class="search-button">検索</button>
<div class="search-container"><div class="search-space"><input class="search-bar">
<div class="search-layout" data-preview="true"></div></div></div></div></div>
<div class="center"><article class="popover-hint"><p>超大陸についての導入文。通常項目と通常検索語。</p>
<div class="before"></div><h3 id="超大陸">超大陸</h3><div class="after"></div></article></div>
<a class="plain-redirect" href="/quartz/超大陸">超大陸へ</a>
<script data-persist src="/redirect.js"></script><script data-persist src="/search.js"></script>
<script data-persist src="/spa.js"></script></body></html>`

async function open(page: Page, slug = "古原生代", hash = "") {
  await page.route("http://quartz.test/**", async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname in scripts)
      return route.fulfill({ contentType: "text/javascript", body: scripts[url.pathname] })
    if (url.pathname.endsWith("heading-redirects.json")) {
      return route.fulfill({ json: { 超大陸: target } })
    }
    return route.fulfill({
      contentType: "text/html",
      body: html(decodeURIComponent(url.pathname.split("/").at(-1)!)),
    })
  })
  await page.goto(`http://quartz.test/quartz/${encodeURIComponent(slug)}${hash}`)
  await expect(page.locator(".results-container")).toHaveCount(1)
}

async function search(page: Page, term = "超大陸") {
  await page.locator(".search-button").click()
  await page.locator(".search-bar").fill(term)
  const result = page.locator(`.result-card[data-slug="${term}"]`)
  await expect(result).toBeVisible()
  if (term === "超大陸") await expect(result).toHaveAttribute("href", target)
  return result
}

async function atHeading(page: Page) {
  await expect
    .poll(() =>
      page
        .locator('.center article h3[id="超大陸"]')
        .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
    )
    .toBe(64)
}

test("same-page search selects the article heading, including repeat clicks", async ({ page }) => {
  await open(page)
  for (let i = 0; i < 2; i++) {
    const result = await search(page)
    await expect(result).not.toHaveAttribute("id")
    await result.click()
    await atHeading(page)
    await expect(page.locator(".search-container")).not.toHaveClass(/active/)
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("search-term"))).toBeNull()
    await page.waitForTimeout(250)
    await atHeading(page)
  }
})

test("Enter activates an attached result through delegated routing", async ({ page }) => {
  await open(page)
  await search(page)
  await page.locator(".search-bar").press("Enter")
  await atHeading(page)
  await expect(page).toHaveURL(new RegExp(`${encodeURIComponent("古原生代")}#`))
})

test("cross-page search uses the real Quartz SPA router", async ({ page }) => {
  await open(page, "index")
  await (await search(page)).click()
  await expect(page).toHaveURL(`http://quartz.test${target}`)
  await atHeading(page)
  await expect(page.locator(".search-scroll-target")).toHaveCount(0)
})

test("preview ID copies never become scroll targets", async ({ page }) => {
  await open(page)
  await page.evaluate(() => {
    const copy = document.createElement("h3")
    copy.id = "超大陸"
    document.body.prepend(copy)
  })
  await (await search(page)).click()
  await atHeading(page)
})

test("viewport changes correct layout until reader interaction", async ({ page }) => {
  await open(page)
  await (await search(page)).click()
  await atHeading(page)
  await page.evaluate(() => {
    document.querySelector<HTMLElement>(".before")!.style.height = "2100px"
    window.visualViewport?.dispatchEvent(new Event("resize"))
  })
  await atHeading(page)
  await page.evaluate(() => {
    document.dispatchEvent(new Event("touchstart"))
    window.scrollTo(0, 0)
    window.visualViewport?.dispatchEvent(new Event("resize"))
  })
  await page.waitForTimeout(100)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
})

test("explicit hash suppresses search-term scrolling on nav", async ({ page }) => {
  await open(page, "古原生代", `#${encodeURIComponent("超大陸")}`)
  await page.evaluate(() => {
    sessionStorage.setItem("search-term", "超大陸")
    document.dispatchEvent(new CustomEvent("nav", { detail: { url: "古原生代" } }))
  })
  await atHeading(page)
  await expect(page.locator(".search-scroll-target")).toHaveCount(0)
})

test("ordinary search still highlights its term and Escape restores focus", async ({ page }) => {
  await open(page)
  await search(page, "通常項目")
  await page.locator(".search-bar").press("Escape")
  await expect(page.locator(".search-button")).toBeFocused()
  await (await search(page, "通常項目")).click()
  await expect(page.locator(".search-scroll-target")).toHaveCount(1)
})

test("modified clicks retain native behavior", async ({ page }) => {
  await open(page)
  const result = await search(page)
  const prevented = await result.evaluate((el) => {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true })
    el.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(prevented).toBe(false)
  await expect(page.locator(".search-container")).toHaveClass(/active/)
})

test("ordinary links and direct visits align with the article heading", async ({ page }) => {
  await open(page)
  const link = page.locator(".plain-redirect")
  await expect(link).toHaveAttribute("href", target)
  await link.click()
  await atHeading(page)
  await page.reload()
  await atHeading(page)
})
