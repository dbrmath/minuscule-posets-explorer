(function boot() {
  "use strict";

  window.addEventListener("DOMContentLoaded", () => {
    if (!window.MinusculeUI || typeof window.MinusculeUI.init !== "function") {
      throw new Error("MinusculeUI.init is unavailable.");
    }
    window.MinusculeUI.init();
  });
})();
