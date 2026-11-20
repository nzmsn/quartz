import { computePosition, flip, inline, shift } from "@floating-ui/dom"
import { normalizeRelativeURLs } from "../../util/path"
import { fetchCanonical } from "./util"

const p = new DOMParser()
let activeAnchor: HTMLAnchorElement | null = null

async function mouseEnterHandler(
  this: HTMLAnchorElement,
  { clientX, clientY }: { clientX: number; clientY: number },
) {
  const link = (activeAnchor = this)
  if (useFootnoteSheet()) return
  if (link.dataset.noPopover === "true") {
    return
  }

  async function setPosition(popoverElement: HTMLElement) {
    const { x, y } = await computePosition(link, popoverElement, {
      strategy: "fixed",
      middleware: [inline({ x: clientX, y: clientY }), shift(), flip()],
    })
    Object.assign(popoverElement.style, {
      transform: `translate(${x.toFixed()}px, ${y.toFixed()}px)`,
    })
  }

  function showPopover(popoverElement: HTMLElement) {
    clearActivePopover()
    popoverElement.classList.add("active-popover")
    setPosition(popoverElement as HTMLElement)

    if (hash !== "" && !isFootnote) {
      const inner = popoverElement.querySelector(".popover-inner") as HTMLElement | null
      if (inner) {
        const targetAnchor = `#popover-internal-${hash.slice(1)}`
        const heading = inner.querySelector(targetAnchor) as HTMLElement | null
        if (heading) {
          // leave ~12px of buffer when scrolling to a heading
          inner.scroll({ top: heading.offsetTop - 12, behavior: "instant" })
        }
      }
    }
  }

  const targetUrl = new URL(link.href)
  const hash = decodeURIComponent(targetUrl.hash)
  const isFootnote = link.hasAttribute("data-footnote-ref") && hash !== ""
  targetUrl.hash = ""
  targetUrl.search = ""
  const popoverId = `popover-${link.pathname}${isFootnote ? hash : ""}`
  const prevPopoverElement = document.getElementById(popoverId)

  // dont refetch if there's already a popover
  if (!!document.getElementById(popoverId)) {
    showPopover(prevPopoverElement as HTMLElement)
    return
  }

  const response = await fetchCanonical(targetUrl).catch((err) => {
    console.error(err)
  })

  if (!response) return
  const rawContentType = response.headers.get("Content-Type")
  if (!rawContentType) return
  const [contentType] = rawContentType.split(";")
  const [contentTypeCategory, typeInfo] = contentType.split("/")

  const popoverElement = document.createElement("div")
  popoverElement.id = popoverId
  popoverElement.classList.add("popover")
  const popoverInner = document.createElement("div")
  popoverInner.classList.add("popover-inner")
  popoverInner.dataset.contentType = contentType ?? undefined
  popoverElement.appendChild(popoverInner)

  switch (contentTypeCategory) {
    case "image":
      const img = document.createElement("img")
      img.src = targetUrl.toString()
      img.alt = targetUrl.pathname

      popoverInner.appendChild(img)
      break
    case "application":
      switch (typeInfo) {
        case "pdf":
          const pdf = document.createElement("iframe")
          pdf.src = targetUrl.toString()
          popoverInner.appendChild(pdf)
          break
        default:
          break
      }
      break
    default:
      const contents = await response.text()
      const html = p.parseFromString(contents, "text/html")
      normalizeRelativeURLs(html, targetUrl)
      // prepend all IDs inside popovers to prevent duplicates
      html.querySelectorAll("[id]").forEach((el) => {
        const targetID = `popover-internal-${el.id}`
        el.id = targetID
      })
      if (isFootnote) {
        const footnote = html.getElementById(`popover-internal-${hash.slice(1)}`)
        if (!footnote || footnote.tagName !== "LI") return

        const note = footnote.cloneNode(true) as HTMLElement
        note.querySelectorAll("[data-footnote-backref]").forEach((el) => el.remove())

        const list = document.createElement("ol")
        const number = Number.parseInt(link.textContent?.trim() ?? "", 10)
        if (Number.isFinite(number) && number > 0) list.start = number
        list.appendChild(note)
        popoverInner.appendChild(list)
      } else {
        const elts = [...html.getElementsByClassName("popover-hint")]
        if (elts.length === 0) return

        elts.forEach((elt) => popoverInner.appendChild(elt))
      }
  }

  if (!!document.getElementById(popoverId)) {
    return
  }

  document.body.appendChild(popoverElement)
  if (activeAnchor !== this) {
    return
  }

  showPopover(popoverElement)
}

function clearActivePopover() {
  activeAnchor = null
  const allPopoverElements = document.querySelectorAll(".popover")
  allPopoverElements.forEach((popoverElement) => popoverElement.classList.remove("active-popover"))
}

function setupPopovers() {
  const links = [...document.querySelectorAll("a.internal")] as HTMLAnchorElement[]
  for (const link of links) {
    // Let native anchor navigation update CSS :target for footnotes.
    // Mobile footnotes are still intercepted by the bottom-sheet handler.
    if (link.hasAttribute("data-footnote-ref")) {
      link.dataset.routerIgnore = ""
    }
    link.addEventListener("mouseenter", mouseEnterHandler)
    link.addEventListener("mouseleave", clearActivePopover)
    window.addCleanup(() => {
      link.removeEventListener("mouseenter", mouseEnterHandler)
      link.removeEventListener("mouseleave", clearActivePopover)
    })
  }
}

document.addEventListener("nav", setupPopovers)
document.addEventListener("render", setupPopovers)

// Mobile footnotes use a modal bottom sheet instead of hover previews.
function useFootnoteSheet() {
  return window.matchMedia("(max-width: 800px), (hover: none)").matches
}

let footnoteDialog: HTMLDialogElement | null = null
let footnoteTrigger: HTMLAnchorElement | null = null

function closeFootnoteSheet(restoreFocus = true) {
  if (!footnoteDialog) return
  footnoteDialog.close()
  footnoteDialog.remove()
  footnoteDialog = null
  document.documentElement.classList.remove("footnote-sheet-open")
  if (restoreFocus && footnoteTrigger?.isConnected) footnoteTrigger.focus({ preventScroll: true })
  footnoteTrigger = null
}

document.addEventListener("click", (event: MouseEvent) => {
  if (!useFootnoteSheet() || event.button !== 0) return
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  const target = event.target
  if (!(target instanceof Element)) return
  const link = target.closest<HTMLAnchorElement>("a[data-footnote-ref]")
  if (!link || link.dataset.noPopover === "true") return

  // Read the current page's footnote directly, without a network request.
  const url = new URL(link.href)
  const current = new URL(window.location.href)
  if (url.origin !== current.origin || url.pathname !== current.pathname) return
  let id: string
  try {
    id = decodeURIComponent(url.hash.slice(1))
  } catch {
    return
  }
  const footnote = document.getElementById(id)
  if (!footnote || footnote.tagName !== "LI") return

  event.preventDefault()
  event.stopImmediatePropagation()
  clearActivePopover()
  closeFootnoteSheet(false)
  footnoteTrigger = link

  const dialog = document.createElement("dialog")
  dialog.className = "mobile-footnote-sheet"
  dialog.setAttribute("aria-labelledby", "mobile-footnote-title")

  const header = document.createElement("header")
  header.className = "mobile-footnote-header"
  const title = document.createElement("h2")
  title.id = "mobile-footnote-title"
  title.textContent = `脚注 ${link.textContent?.trim() ?? ""}`
  const close = document.createElement("button")
  close.type = "button"
  close.className = "mobile-footnote-close"
  close.setAttribute("aria-label", "脚注を閉じる")
  close.textContent = "×"
  close.autofocus = true
  close.addEventListener("click", () => closeFootnoteSheet())
  header.append(title, close)

  const body = document.createElement("div")
  body.className = "mobile-footnote-body"
  const note = footnote.cloneNode(true) as HTMLElement
  note.querySelectorAll("[data-footnote-backref]").forEach((el) => el.remove())
  note.removeAttribute("id")
  note.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"))
  // Keep paragraphs, citations, and links, without the list marker.
  body.append(...Array.from(note.childNodes))
  dialog.append(header, body)

  dialog.addEventListener("click", (click) => {
    if (click.target !== dialog) return
    const rect = dialog.getBoundingClientRect()
    if (click.clientX < rect.left || click.clientX > rect.right ||
        click.clientY < rect.top || click.clientY > rect.bottom) closeFootnoteSheet()
  })
  dialog.addEventListener("cancel", (cancel) => {
    cancel.preventDefault()
    closeFootnoteSheet()
  })
  document.body.appendChild(dialog)
  footnoteDialog = dialog
  dialog.showModal()
  document.documentElement.classList.add("footnote-sheet-open")
}, true)

document.addEventListener("nav", () => closeFootnoteSheet(false))
window.addEventListener("pagehide", () => closeFootnoteSheet(false))
