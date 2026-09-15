const root = document.documentElement;
const storedTheme = localStorage.getItem("phoenix-theme");
const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
root.dataset.theme = storedTheme ?? (prefersLight ? "light" : "dark");

const themeButton = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
if (themeButton) {
  const syncLabel = () => {
    const light = root.dataset.theme === "light";
    themeButton.textContent = light ? "☾" : "☀";
    themeButton.setAttribute("aria-label", light ? "فعال‌کردن پوسته تاریک" : "فعال‌کردن پوسته روشن");
  };
  syncLabel();
  themeButton.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
    localStorage.setItem("phoenix-theme", root.dataset.theme);
    syncLabel();
  });
}

document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const targetId = link.getAttribute("href")?.slice(1);
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${targetId}`);
  });
});

const header = document.querySelector<HTMLElement>("[data-shell]");
if (header) {
  const onScroll = () => header.toggleAttribute("data-scrolled", window.scrollY > 10);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}
