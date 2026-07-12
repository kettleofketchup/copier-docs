// Click-to-zoom for Mermaid diagrams. Dependency-free (no CDN) so it works on
// the airgapped darknet build. Click a diagram to open a fullscreen overlay;
// scroll to zoom (around the cursor), drag to pan, +/-/reset controls, Esc or
// click-backdrop to close. Progressive enhancement: if this never runs, the
// static inline diagram is unaffected.
(function () {
  "use strict";

  var overlay, canvas, scale, tx, ty, dragging, lastX, lastY;

  function makeZoomable(host) {
    if (host.dataset.mzoom) return;
    if (!host.querySelector("svg")) return; // mermaid hasn't rendered yet
    host.dataset.mzoom = "1";
    host.classList.add("mzoom-src");
    host.setAttribute("title", "Click to zoom");
    host.addEventListener("click", function () {
      openOverlay(host.querySelector("svg"));
    });
  }

  function scan() {
    var nodes = document.querySelectorAll(".mermaid");
    for (var i = 0; i < nodes.length; i++) makeZoomable(nodes[i]);
  }

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "mzoom-overlay";
    overlay.innerHTML =
      '<div class="mzoom-canvas"></div>' +
      '<div class="mzoom-controls" role="group" aria-label="Diagram zoom">' +
      '<button type="button" data-a="out" aria-label="Zoom out">−</button>' +
      '<button type="button" data-a="reset" aria-label="Reset zoom">↺</button>' +
      '<button type="button" data-a="in" aria-label="Zoom in">+</button>' +
      '<button type="button" data-a="close" aria-label="Close">✕</button>' +
      "</div>";
    document.body.appendChild(overlay);
    canvas = overlay.querySelector(".mzoom-canvas");

    overlay.addEventListener("pointerdown", function (e) {
      if (e.target === overlay) closeOverlay();
    });
    overlay.querySelector(".mzoom-controls").addEventListener("click", function (e) {
      var a = e.target.getAttribute("data-a");
      if (!a) return;
      if (a === "close") return closeOverlay();
      if (a === "reset") return setT(1, 0, 0);
      var w = overlay.clientWidth / 2, h = overlay.clientHeight / 2;
      zoomBy(a === "in" ? 1.3 : 1 / 1.3, w, h);
    });
    overlay.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.addEventListener("keydown", function (e) {
      if (!overlay.classList.contains("open")) return;
      if (e.key === "Escape") closeOverlay();
    });
  }

  function openOverlay(svg) {
    ensureOverlay();
    canvas.innerHTML = "";
    var clone = svg.cloneNode(true);
    clone.removeAttribute("style");
    clone.removeAttribute("width");
    clone.removeAttribute("height");
    canvas.appendChild(clone);
    document.body.classList.add("mzoom-lock");
    overlay.classList.add("open");
    setT(1, 0, 0);
  }

  function closeOverlay() {
    if (!overlay) return;
    overlay.classList.remove("open");
    document.body.classList.remove("mzoom-lock");
    canvas.innerHTML = "";
  }

  function setT(s, x, y) {
    scale = s; tx = x; ty = y;
    canvas.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
  }

  function zoomBy(factor, px, py) {
    var ns = Math.min(12, Math.max(0.2, scale * factor));
    // keep the point (px,py) fixed while scaling
    tx = px - (px - tx) * (ns / scale);
    ty = py - (py - ty) * (ns / scale);
    setT(ns, tx, ty);
  }

  function onWheel(e) {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
  }
  function onDown(e) { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.style.cursor = "grabbing"; }
  function onMove(e) {
    if (!dragging) return;
    setT(scale, tx + (e.clientX - lastX), ty + (e.clientY - lastY));
    lastX = e.clientX; lastY = e.clientY;
  }
  function onUp() { dragging = false; if (canvas) canvas.style.cursor = "grab"; }

  // Mermaid renders SVGs asynchronously (and again on instant-nav). A
  // MutationObserver re-scans whenever the DOM changes; makeZoomable is
  // idempotent, so repeated scans are cheap.
  var mo = new MutationObserver(scan);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState !== "loading") scan();
  else document.addEventListener("DOMContentLoaded", scan);
})();
