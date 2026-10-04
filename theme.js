(() => {
  const THEME_KEY = "skwodnjs-english:theme:v1";
  const LIGHT_THEME_COLOR = "#f7f7f8";
  const DARK_THEME_COLOR = "#171717";

  function readTheme() {
    try {
      return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  }

  function applyTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);

    const button = document.querySelector("#themeToggleButton");
    if (button) {
      const dark = next === "dark";
      button.setAttribute("aria-pressed", String(dark));
      button.setAttribute("aria-label", dark ? "라이트 모드로 전환" : "다크 모드로 전환");
      button.title = dark ? "라이트 모드" : "다크 모드";
      button.querySelector(".theme-sun-icon")?.toggleAttribute("hidden", dark);
      button.querySelector(".theme-moon-icon")?.toggleAttribute("hidden", !dark);
    }
  }

  const initialTheme = readTheme();
  applyTheme(initialTheme);

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(readTheme());
    const button = document.querySelector("#themeToggleButton");
    if (!button) return;

    button.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      try { localStorage.setItem(THEME_KEY, next); } catch {}
      applyTheme(next);
    });
  });
})();
