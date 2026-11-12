// Applies the stored/system theme before first paint (no flash). Loaded as a
// same-origin script with the CSP nonce, so no inline script is needed.
(function () {
  var root = document.documentElement;
  try {
    var t = localStorage.getItem("zk-theme");
    if (t !== "light" && t !== "dark") {
      t = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    root.dataset.theme = t;
  } catch (e) {}
  root.classList.remove("no-js");
})();
