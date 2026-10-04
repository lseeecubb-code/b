// Shows script load failures and runtime errors in a red box at the bottom of the page.
// Add as the FIRST script in <head>:  <script src="errorlog.js"></script>
(function () {
  const box = document.createElement("pre");
  box.style.cssText =
    "position:fixed;left:0;right:0;bottom:0;max-height:45vh;overflow:auto;margin:0;padding:8px 12px;" +
    "background:#2a0910;color:#ffb3c0;font:12px ui-monospace,monospace;z-index:99999;white-space:pre-wrap";
  const log = (m) => {
    if (!box.parentNode) document.documentElement.appendChild(box);
    box.textContent += m + "\n";
  };
  window.addEventListener("error", (e) => {
    if (e.target && e.target !== window) log("FAILED TO LOAD: " + (e.target.src || e.target.href));
    else log("ERROR: " + e.message + "\n   at " + String(e.filename || "").split("/").pop() + ":" + e.lineno + ":" + e.colno);
  }, true);
  window.addEventListener("unhandledrejection", (e) => log("PROMISE ERROR: " + ((e.reason && e.reason.stack) || e.reason)));
  setTimeout(() => {
    const s = document.getElementById("screen");
    if (s && !s.textContent.trim()) log("NOTE: the game screen is still empty after 3 seconds.");
  }, 3000);
})();
