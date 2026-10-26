// Click-to-zoom and export for Mermaid diagrams. Dependency-free (no CDN) so it
// works on the airgapped darknet build. Each rendered diagram gets a visible ⛶
// button (top-right); clicking it — or anywhere on the diagram — opens a
// fullscreen overlay: scroll to zoom (around the cursor), drag to pan, +/−/reset
// controls, Esc or click-backdrop to close. Below each diagram, Copy image /
// Download PNG / Copy Mermaid export it for pasting elsewhere. Progressive
// enhancement: if this never runs, the static inline diagram is unaffected.
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

    wrap.parentNode.insertBefore(exportBar(src), wrap.nextSibling);
  }

  // ---- Export ---------------------------------------------------------------
  // Re-rendered in the site's theme with SVG text labels: an HTML label
  // (foreignObject) taints the canvas, always in Safari. The theme colours HTML
  // labels with `color`, so SVG text needs its `fill` set to match. Edges are
  // white over a black halo with outlined arrowheads, so the PNG reads on a
  // black or a white background.
  var EXPORT_INIT = '%%{init: {"htmlLabels": false, "flowchart": {"htmlLabels": false}}}%%\n';
  var LABEL_CSS =
    ".label text, .label tspan { fill: var(--md-mermaid-label-fg-color) !important; }" +
    ".edgeLabel text, .edgeLabel tspan { fill: var(--md-mermaid-edge-color) !important; }" +
    ".edgeLabel rect { fill: var(--md-default-bg-color) !important; opacity: 1 !important; }" +
    "text { font-family: var(--md-mermaid-font-family); }" +
    ".flowchart-link { stroke: #fff !important; stroke-width: 1.5px !important; }" +
    ".flowchart-link.export-halo { stroke: #000 !important; stroke-width: 4px !important; }" +
    "marker path { fill: #fff !important; stroke: #000 !important; stroke-width: 1px !important;" +
    " stroke-dasharray: none !important; }";
  // Node and label fills are translucent and borrow the page colour behind them;
  // flatten them onto it, or a transparent PNG shows pale boxes and unreadable
  // light text. Edge labels get the page colour as a solid box for the same reason.
  var OPAQUE_VARS = ["--md-mermaid-node-bg-color", "--md-mermaid-label-bg-color", "--md-default-bg-color"];
  var EXPORT_SCALE = 2;
  // The clipboard API exists only on https/localhost; Download PNG works anywhere.
  var canCopy = !!(window.isSecureContext && navigator.clipboard);

  function exportBar(src) {
    var bar = document.createElement("div");
    bar.className = "mzoom-export";
    if (canCopy && typeof ClipboardItem !== "undefined") {
      bar.appendChild(exportBtn("Copy image", "Copied", function () {
        // A promise, not an awaited blob, so Safari still counts it as part of the click.
        return navigator.clipboard.write([new ClipboardItem({ "image/png": toPng(src) })]);
      }));
    }
    bar.appendChild(exportBtn("Download PNG", "Saved", function () {
      return toPng(src).then(function (blob) { download(blob, "diagram.png"); });
    }));
    if (canCopy) {
      bar.appendChild(exportBtn("Copy Mermaid", "Copied", function () {
        return navigator.clipboard.writeText(src);
      }));
    }
    return bar;
  }

  function exportBtn(label, doneLabel, action) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", function () {
      var result;
      try { result = Promise.resolve(action()); } catch (err) { result = Promise.reject(err); }
      result.then(
        function () { btn.textContent = doneLabel; },
        function (err) { console.error("mermaid export failed", err); btn.textContent = "Failed"; }
      ).then(function () {
        setTimeout(function () { btn.textContent = label; }, 1500);
      });
    });
    return btn;
  }

  function toPng(src) {
    if (typeof mermaid === "undefined" || !mermaid.render) {
      return Promise.reject(new Error("mermaid is not loaded"));
    }
    return Promise.resolve(mermaid.render("mzoom_png_" + seq++, EXPORT_INIT + src)).then(function (res) {
      var svg = new DOMParser().parseFromString(res.svg, "image/svg+xml").documentElement;
      var edges = svg.querySelectorAll("path.flowchart-link");
      for (var e = 0; e < edges.length; e++) {
        var halo = edges[e].cloneNode(false);
        halo.classList.add("export-halo");
        halo.removeAttribute("id");
        halo.removeAttribute("marker-start");
        halo.removeAttribute("marker-end");
        edges[e].parentNode.insertBefore(halo, edges[e]);
      }
      var style = document.createElementNS("http://www.w3.org/2000/svg", "style");
      style.textContent = LABEL_CSS;
      svg.appendChild(style);
      // The theme's colours are page CSS variables, which mean nothing inside an image.
      var lookup = pageColours(getComputedStyle(document.body));
      var styles = svg.querySelectorAll("style");
      for (var i = 0; i < styles.length; i++) styles[i].textContent = resolveVars(styles[i].textContent, lookup);
      var box = svg.getAttribute("viewBox").split(/[\s,]+/).map(Number);
      var w = box[2], h = box[3];
      svg.setAttribute("width", w);
      svg.setAttribute("height", h);
      svg.removeAttribute("style");
      var url = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" })
      );
      return loadImage(url).then(function (img) {
        var c = document.createElement("canvas");
        c.width = Math.ceil(w * EXPORT_SCALE);
        c.height = Math.ceil(h * EXPORT_SCALE);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        return new Promise(function (resolve, reject) {
          c.toBlob(function (blob) {
            if (blob) resolve(blob); else reject(new Error("toBlob failed"));
          }, "image/png");
        });
      }).then(
        function (blob) { URL.revokeObjectURL(url); return blob; },
        function (err) { URL.revokeObjectURL(url); throw err; }
      );
    });
  }

  function pageColours(page) {
    var base = page.getPropertyValue("--md-default-bg-color").trim() || page.backgroundColor;
    return function (name) {
      var value = page.getPropertyValue(name).trim();
      return value && OPAQUE_VARS.indexOf(name) !== -1 ? flatten(value, base) : value;
    };
  }

  function flatten(colour, base) {
    var top = rgba(colour);
    if (top[3] >= 1) return colour;
    var under = rgba(base);
    var mix = function (i) { return Math.round(top[i] * top[3] + under[i] * (1 - top[3])); };
    return "rgb(" + mix(0) + ", " + mix(1) + ", " + mix(2) + ")";
  }

  // Let the browser parse any CSS colour by painting one pixel of it.
  function rgba(colour) {
    var ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 1, 1);
    var d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  }

  function resolveVars(css, lookup) {
    var VAR = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g;
    for (var pass = 0; pass < 5 && css.indexOf("var(") !== -1; pass++) {
      css = css.replace(VAR, function (_, name, fallback) {
        return lookup(name) || fallback || "initial";
      });
    }
    return css;
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("diagram image failed to load")); };
      img.src = url;
    });
  }

  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
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
