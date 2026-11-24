import { test, expect, type Page } from "@playwright/test"

const base = process.env.QUARTZ_TEST_URL
test.skip(!base, "Set QUARTZ_TEST_URL to a running Quartz --serve URL")

test.beforeEach(async ({ page }) => {
  // Offline fonts do not affect the URL / routing assertions.
  await page.route("https://**", (route) => route.abort())
})

const url = (slug: string) => `${base}${slug === "index" ? "" : encodeURIComponent(slug)}`

async function aligned(page: Page, heading: string) {
  await expect.poll(() => new URL(page.url()).hash).toBe(`#${encodeURIComponent(heading)}`)
  const target = page.locator(`.center article :is(h1,h2,h3,h4,h5,h6)[id="${heading}"]`)
  await expect(target).toBeVisible()
  await expect
    .poll(async () => {
      const top = await target.evaluate((el) => el.getBoundingClientRect().top)
      return top >= -2 && top <= 150
    })
    .toBe(true)
}

for (const from of ["index", "冥王代"]) {
  test(`real server: search redirect from ${from}`, async ({ page }) => {
    const failures: string[] = []
    page.on("response", (response) => {
      if (response.url().startsWith(base!) && response.status() >= 400)
        failures.push(response.url())
    })
    await page.goto(url(from))
    await expect(page.locator(".results-container")).toHaveCount(1)
    await page.locator(".search-button:visible").click()
    await page.locator(".search-bar:visible").fill("アエンデ隕石")
    const card = page.locator('.result-card[data-slug="アエンデ隕石"]')
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute("data-heading-redirect-marked", "true")
    await card.click()
    await aligned(page, "アエンデ隕石")
    expect(failures).toEqual([])
  })
}

test("real server: internal redirect link reaches its heading", async ({ page }) => {
  await page.goto(url("冥王代"))
  const link = page
    .locator(".center article p a")
    .filter({ hasText: /^アエンデ隕石$/ })
    .first()
  await expect(link).toHaveAttribute("data-heading-redirect-marked", "true")
  await link.click()
  await aligned(page, "アエンデ隕石")
})

test("real server: direct redirect HTML reaches its heading", async ({ page }) => {
  await page.goto(url("アエンデ隕石"))
  await aligned(page, "アエンデ隕石")
})
