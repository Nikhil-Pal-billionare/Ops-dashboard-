(function () {
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function shrink(f) {
    return new Promise(function (res) {
      var i = new Image();
      i.onload = function () {
        var k = Math.min(1, 1400 / Math.max(i.width, i.height));
        var c = document.createElement("canvas");
        c.width = Math.round(i.width * k);
        c.height = Math.round(i.height * k);
        c.getContext("2d").drawImage(i, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", 0.8));
      };
      i.src = URL.createObjectURL(f);
    });
  }
  function opts(list) { return list.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + "</option>"; }).join(""); }

  window.mountPW = function (root, api, cfg) {
    var cl = cfg.clients || [];
    if (!cl.length) { root.innerHTML = '<p class="note">Abhi koi client add nahi hua. Config me client add karo.</p>'; return; }
    root.innerHTML =
      '<label>Client</label><select id="pw-c">' + cl.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + " (" + esc(x.country) + ")</option>"; }).join("") + "</select>" +
      '<label>Niche</label><select id="pw-n"></select>' +
      '<label>Pin style</label><select id="pw-s"></select>' +
      '<label>Listing screenshot (Etsy / Shopify), max 3</label><input id="pw-f" type="file" accept="image/*" multiple>' +
      '<label>Extra listing text (optional)</label><textarea id="pw-t" style="width:100%;min-height:80px"></textarea>' +
      '<p><button class="btn primary" id="pw-go">Generate pins</button></p><div class="note" id="pw-e"></div><div id="pw-o"></div>';
    var $ = function (id) { return root.querySelector("#" + id); };
    function fill() {
      var c = cl.filter(function (x) { return x.id === $("pw-c").value; })[0];
      $("pw-n").innerHTML = opts((cfg.niches || []).filter(function (n) { return (c.niches || []).indexOf(n.id) > -1; }));
      $("pw-s").innerHTML = opts((cfg.styles || []).filter(function (n) { return (c.styles || []).indexOf(n.id) > -1; }));
    }
    $("pw-c").onchange = fill;
    fill();
    var copies = [];
    root.onclick = function (e) {
      var b = e.target.closest("[data-cp]");
      if (!b) return;
      var t = copies[+b.getAttribute("data-cp")];
      if (navigator.clipboard) navigator.clipboard.writeText(t);
      b.textContent = "Copied";
      setTimeout(function () { b.textContent = "Copy"; }, 1200);
    };
    function field(l, t) {
      copies.push(t);
      return '<div style="margin-top:10px"><b class="note">' + esc(l.toUpperCase()) + '</b><p style="white-space:pre-wrap;margin:4px 0 6px">' + esc(t) + '</p><button class="btn" data-cp="' + (copies.length - 1) + '">Copy</button></div>';
    }
    $("pw-go").onclick = function () {
      var files = Array.prototype.slice.call($("pw-f").files || [], 0, 3);
      var text = $("pw-t").value.trim();
      $("pw-e").textContent = "";
      if (!files.length && !text) { $("pw-e").textContent = "Screenshot upload karo ya listing text daalo."; return; }
      $("pw-go").disabled = true;
      $("pw-go").textContent = "Generating...";
      Promise.all(files.map(shrink)).then(function (images) {
        return api("generate", { client: $("pw-c").value, niche: $("pw-n").value, style: $("pw-s").value, listing: text, images: images });
      }).then(function (d) {
        copies = [];
        var h = (d.pins || []).map(function (p, i) {
          return '<div style="border-left:3px solid var(--pin, #0E7C6E);padding:8px 12px;margin:12px 0"><b>Pin ' + (i + 1) + (p.angle ? " - " + esc(p.angle) : "") + "</b>" +
            field("Pin Title", p.title) + field("Pin Description", p.description) + field("Alt Text", p.alt_text) + field("ChatGPT Image Prompt", p.image_prompt) + "</div>";
        }).join("");
        (d.listing_flags || []).forEach(function (f) { h += '<p class="note">Flag: ' + esc(f) + "</p>"; });
        if (d.business_note) h += '<p class="note">Business note: ' + esc(d.business_note) + "</p>";
        $("pw-o").innerHTML = h;
      }).catch(function (e) { $("pw-e").textContent = e.message || "Generate nahi hua."; })
        .then(function () { $("pw-go").disabled = false; $("pw-go").textContent = "Generate pins"; });
    };
  };
})();
