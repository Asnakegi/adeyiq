/* AdeyIQ usage counter: page opens and tool actions → /api/track → Google Sheet "Usage" tab.
   Sends an anonymous random visitor id, the page, the action and a short status (how many ULDs, balanced or not);
   never AWBs, goods, dimensions, weights, DG details or file contents, no names, no IP address. */
(function () {
  var vid = "anon";
  try {
    vid = localStorage.getItem("adeyiq-vid");
    if (!vid) { vid = Math.random().toString(36).slice(2, 12); localStorage.setItem("adeyiq-vid", vid); }
    /* the owner marks a device once with ?owner=1 (and clears it with ?owner=0); its visits are sent as owner-… and left out of the summary */
    var om = /[?&]owner=([01])/.exec(location.search);
    if (om) { if (om[1] === "1") localStorage.setItem("adeyiq-owner", "1"); else localStorage.removeItem("adeyiq-owner"); }
    if (localStorage.getItem("adeyiq-owner") === "1") vid = "owner-" + vid;
  } catch (e) {}
  var sid = Math.random().toString(36).slice(2, 10);
  var page = location.pathname || "/";
  function el(id) { return document.getElementById(id); }
  function txt(id) { var e = el(id); return e ? (e.innerText || e.textContent).replace(/\s+/g, " ").trim() : ""; }
  function send(event, detail) {
    try {
      var pick = document.querySelector('.pick[aria-pressed="true"]');
      var ac = el("acSel") ? el("acSel").value : (pick && pick.dataset.ac) || "";
      var body = JSON.stringify({ event: event, page: page, visitor: vid, session: sid, aircraft: ac || "", detail: String(detail || "").slice(0, 300), ref: refOrigin(), w: innerWidth });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "text/plain" }));
      else fetch("/api/track", { method: "POST", body: body, keepalive: true });
    } catch (e) {}
  }
  /* only the site that linked here (scheme + host), never the full referring URL */
  function refOrigin() { try { if (!document.referrer) return ""; var u = new URL(document.referrer); return (u.protocol + "//" + u.host).slice(0, 100); } catch { return ""; } }
  /* a status without numbers that come from the cargo (weights, tonnes): e.g. "9 ULDs built" or "Balanced ✓ · 2 offloaded" */
  function count(id) { var m = /^\s*(\d+)\s+ULDs?\b/.exec(txt(id)); return m ? m[1] + " ULDs built" : ""; }
  function status() { return txt("st2s").replace(/[\d.,]+\s*(kg|t)\b/gi, "").trim(); }
  function later(event, info) { setTimeout(function () { send(event, info ? info() : ""); }, 900); }
  function built() { return count("st1s"); }
  function loaded() { return status(); }
  send("open");
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest && e.target.closest("button");
    if (!t) return;
    var id = t.id;
    if (id === "sampleBtn") later("try sample", built);
    else if (id === "toLoad" || id === "st2") later("load aircraft", loaded);
    else if (id === "reassign") later("rebalance", loaded);
    else if (id === "bLoad") send("loading animation", "");
    else if (id === "bReplay") send("replay build-up", "");
    else if (id === "prtUld") send("print uld", "");
    else if (id === "prtFlight") send("print flight", loaded());
    else if (id === "dlFlight") send("download flight", loaded());
    else if (t.hasAttribute("data-req")) send("request access opened", t.getAttribute("data-req"));
    else if (t.classList.contains("pick")) later("change aircraft", function () { return t.dataset.ac || ""; });
  }, true);
  document.addEventListener("submit", function (e) { if (e.target && e.target.id === "f") later("add cargo", built); }, true);
  document.addEventListener("change", function (e) {
    var id = e.target && e.target.id;
    if (id === "file") later("upload file", built);
    else if (id === "acSel") later("change aircraft", built);
  }, true);
})();
