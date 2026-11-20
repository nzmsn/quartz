// Match the h1–h6 CSS counters in custom.scss, including skipped levels.
document.addEventListener("nav", () => {
  const article = document.querySelector("article")
  if (!article) return

  const counters = Array<number>(6).fill(0)
  const numbers = new Map<string, string>()
  for (const heading of article.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    const level = Number(heading.tagName.slice(1))
    counters[level - 1]++
    counters.fill(0, level)
    if (heading.id) numbers.set(heading.id, counters.slice(0, level).join("-"))
  }

  for (const link of document.querySelectorAll<HTMLAnchorElement>(".toc a[data-for]")) {
    const number = numbers.get(link.dataset.for ?? "")
    if (number) link.dataset.headingNumber = number
    else delete link.dataset.headingNumber
  }
})
