// Click-to-zoom for Mermaid diagrams. Dependency-free (no CDN) so it works on
// the airgapped darknet build. Each rendered diagram gets a visible ⛶ button
// (top-right); clicking it — or anywhere on the diagram — opens a fullscreen
// overlay: scroll to zoom (around the cursor), drag to pan, +/−/reset controls,
// Esc or click-backdrop to close. Progressive enhancement: if this never runs,
// the static inline diagram is unaffected.
//
// Zensical renders each diagram into a CLOSED shadow root and replaces the
// source <pre> with the shadow host:
//
//     let r = k("div", {class: "mermaid"});
//     let {svg} = yield mermaid.render(id, pre.textContent);
//     r.attachShadow({mode: "closed"}).innerHTML = svg;
//     pre.replaceWith(r);
//
// Two consequences drive the design below:
//
//   1. The SVG is unreachable — a closed root leaves `host.shadowRoot` null and
//      `host.querySelector("svg")` empty forever, so the overlay cannot clone
//      the rendered diagram. Instead we snapshot each `<pre class="mermaid">`
//      source at load (before zensical destroys it) and re-render on demand
//      with the same global mermaid, which also yields a crisp SVG at any zoom.
//   2. The button cannot be a child of the host — an element with a shadow root
//      renders only its shadow tree unless that tree has a <slot>, so light-DOM
//      children are invisible. We wrap the host and position the button there.
(function () {
  "use strict";

  var overlay, canvas, scale, tx, ty, dragging, lastX, lastY;
  var anchors = [];
  var seq = 0;

  // Runs while the source <pre> elements are still in the document: this script
  // executes immediately after the theme bundle, and the mermaid mount is async
  // (it waits on the mermaid script load), so the text is still here.
  //
  // Each source is pinned to a hidden marker inserted directly before its <pre>,
  // not to its index. Diagrams mount on scroll-into-view, so they can render in
  // any order; indexing `div.mermaid` would pair a host with another diagram's
  // source. The replacement host is always the marker's next sibling.
  function captureSources() {
    var blocks = document.querySelectorAll("pre.mermaid");
    for (var i = 0; i < blocks.length; i++) {
      var marker = document.createElement("span");
      marker.className = "mzoom-anchor";
      marker.style.display = "none";
      blocks[i].parentNode.insertBefore(marker, blocks[i]);
      anchors.push({ marker: marker, src: blocks[i].textContent });
    }
  }

  function makeZoomable(host, src) {
    if (host.dataset.mzoom) return;
    if (!src) return; // no captured source — leave the diagram alone
    host.dataset.mzoom = "1";

    var wrap = document.createElement("div");
    wrap.className = "mzoom-src";
    host.parentNode.insertBefore(wrap, host);
    wrap.appendChild(host);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mzoom-btn";
    btn.title = "Zoom / fullscreen";
    btn.setAttribute("aria-label", "Zoom diagram");
    btn.textContent = "⛶";
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      openOverlay(src);
    });
    wrap.appendChild(btn);

    wrap.addEventListener("click", function () {
      openOverlay(src);
    });
  }

  function scan() {
    for (var i = 0; i < anchors.length; i++) {
      var host = anchors[i].marker.nextElementSibling;
      if (host && host.tagName === "DIV" && host.classList.contains("mermaid")) {
        makeZoomable(host, anchors[i].src);
      }
    }
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
      if (overlay.classList.contains("open") && e.key === "Escape") closeOverlay();
    });
  }

  function openOverlay(src) {
    if (typeof mermaid === "undefined" || !mermaid.render) return;
    ensureOverlay();
    canvas.innerHTML = "";
    document.body.classList.add("mzoom-lock");
    overlay.classList.add("open");
    setT(1, 0, 0);
    Promise.resolve(mermaid.render("mzoom_svg_" + seq++, src)).then(function (res) {
      if (!overlay.classList.contains("open")) return; // closed while rendering
      canvas.innerHTML = res.svg;
      var svg = canvas.querySelector("svg");
      if (svg) {
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        svg.style.maxWidth = "none";
      }
      setT(1, 0, 0);
    }, closeOverlay);
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
    tx = px - (px - tx) * (ns / scale);
    ty = py - (py - ty) * (ns / scale);
    setT(ns, tx, ty);
  }
  function onWheel(e) { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); }
  function onDown(e) { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.style.cursor = "grabbing"; }
  function onMove(e) {
    if (!dragging) return;
    setT(scale, tx + (e.clientX - lastX), ty + (e.clientY - lastY));
    lastX = e.clientX; lastY = e.clientY;
  }
  function onUp() { dragging = false; if (canvas) canvas.style.cursor = "grab"; }

  captureSources();

  // Diagrams mount asynchronously and one at a time (each replaces its <pre>).
  // Re-scan on DOM changes plus a few delayed passes; makeZoomable is idempotent.
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  [0, 300, 1000, 2500].forEach(function (d) { setTimeout(scan, d); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
})();
