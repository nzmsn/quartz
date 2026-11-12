const selector = ".sitemap-desktop details, .sitemap-menu-panel details";
const getDetails = () => document.querySelectorAll<HTMLDetailsElement>(selector);

let openStates: boolean[] = [];

document.addEventListener("prenav", () => {
  openStates = Array.from(getDetails(), (details) => details.open);
});

document.addEventListener("nav", () => {
  getDetails().forEach((details, index) => {
    const open = openStates[index];
    if (open !== undefined) details.open = open;
  });
});

export default "";