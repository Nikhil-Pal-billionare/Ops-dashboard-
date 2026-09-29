(function () {
  var root = document.getElementById("tab-team");
  var cache = null;
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function key() { try { return localStorage.getItem("ops_dashboard_key") || ""; } catch (e) { return ""; } }
  function api(action, body) {
    return fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json", "x-dashboard-key": key() }, body: JSON.stringify(Object.assign({ action: action }, body || {})) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "Failed"); return d; }); });
  }
  function dt(t) { return new Date(t).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }); }
  function act(action, body) { return api(action, body).then(load).catch(function (e) { alert(e.message); }); }

  function render(d) {
    cache = d;
    var h = "<h3>Work password</h3>";
    h += '<p class="note">Employees ko kaam se pehle ye daalna padta hai. Badalne par kisi ka login nahi jaata, sabko naya password dobara daalna padega. ' + (d.has_work ? "" : "Abhi set nahi hai, isliye employees kaam nahi kar paayenge.") + "</p>";
    h += '<input id="tm-wp" placeholder="New work password"> <button class="btn primary" data-a="wp">Set / change</button>';

    h += "<h3>Employees</h3>";
    h += '<p class="note">Employee page ka link: <b>' + esc(location.origin) + "/team.html</b></p>";
    h += '<div class="tablewrap"><table><thead><tr><th>Email</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
    d.users.forEach(function (u) {
      h += "<tr><td>" + esc(u.email) + "</td><td>" + (u.active ? "active" : "disabled") + '</td><td><button class="btn" data-a="tog" data-id="' + esc(u.id) + '" data-v="' + (u.active ? "0" : "1") + '">' + (u.active ? "Disable" : "Enable") + '</button> <button class="btn" data-a="rp" data-id="' + esc(u.id) + '" data-e="' + esc(u.email) + '">Reset login password</button></td></tr>';
    });
    if (!d.users.length) h += '<tr><td colspan="3" class="empty">Koi employee nahi.</td></tr>';
    h += '</tbody></table></div><input id="tm-ne" type="email" placeholder="Employee email" autocapitalize="none"> <input id="tm-np" placeholder="Login password (6+)"> <button class="btn primary" data-a="add">Add employee</button>';

    h += "<h3>Blocked IPs / devices</h3>";
    if (!d.blocked.length) h += '<p class="note">Koi block nahi hai.</p>';
    else {
      h += '<div class="tablewrap"><table><tbody>';
      d.blocked.forEach(function (b) { h += "<tr><td>" + esc(b.kind) + "</td><td>" + esc(b.value) + '</td><td><button class="btn" data-a="unb" data-k="' + esc(b.kind) + '" data-v="' + esc(b.value) + '">Unblock</button></td></tr>'; });
      h += "</tbody></table></div>";
    }

    h += "<h3>Login history and devices (last 150)</h3>";
    h += '<div class="tablewrap"><table><thead><tr><th>User</th><th>Login (IST)</th><th>Last active</th><th>IP</th><th>Device</th><th>Block</th></tr></thead><tbody>';
    d.sessions.forEach(function (s) {
      h += "<tr><td>" + esc(s.team_users && s.team_users.email) + "</td><td>" + dt(s.created_at) + "</td><td>" + dt(s.last_seen) + "</td><td>" + esc(s.ip) + "</td><td>" + esc((s.ua || "").slice(0, 60)) + '</td><td><button class="btn" data-a="blk" data-k="ip" data-v="' + esc(s.ip) + '">IP</button> <button class="btn" data-a="blk" data-k="device" data-v="' + esc(s.device) + '">Device</button></td></tr>';
    });
    h += "</tbody></table></div>";

    h += "<h3>Generation history (last 150)</h3>";
    h += '<div class="tablewrap"><table><thead><tr><th>User</th><th>Time (IST)</th><th>Client / niche / style</th><th>Input</th><th>First pin title</th></tr></thead><tbody>';
    d.gens.forEach(function (g) {
      h += "<tr><td>" + esc(g.who) + "</td><td>" + dt(g.created_at) + "</td><td>" + esc(g.client + " / " + g.niche + " / " + g.style) + "</td><td>" + esc(g.note) + "</td><td>" + esc(g.output && g.output.pins && g.output.pins[0] && g.output.pins[0].title) + "</td></tr>";
    });
    h += "</tbody></table></div>";

    h += "<h3>Pin Writer</h3><div id=\"tm-pw\"></div>";

    h += '<div id="tm-setup"></div>';
    h += '<details style="margin-top:24px"><summary class="note" style="cursor:pointer">Advanced: raw JSON (sirf expert ke liye, normal kaam ke liye zaroorat nahi)</summary>';
    h += '<textarea id="tm-cfg" style="width:100%;min-height:300px;font-family:monospace;font-size:12px">' + esc(JSON.stringify(d.cfg, null, 1)) + '</textarea><p><button class="btn primary" data-a="cfg">Save config</button></p></details>';
    root.innerHTML = h;
    setupRender();
    if (window.mountPW) window.mountPW(root.querySelector("#tm-pw"), api, d.cfg || {});
  }

  function load() {
    root.innerHTML = '<p class="note">Loading...</p>';
    return api("overview").then(render).catch(function (e) { root.innerHTML = '<p class="note">Load nahi hua: ' + esc(e.message) + ". Team SQL aur env vars check karo.</p>"; });
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-a]");
    if (!b) return;
    var a = b.getAttribute("data-a"), id = b.getAttribute("data-id"), k = b.getAttribute("data-k"), v = b.getAttribute("data-v");
    var val = function (i) { return root.querySelector("#" + i).value; };
    if (a === "wp") act("setWorkPass", { password: val("tm-wp") });
    else if (a === "add") act("createUser", { email: val("tm-ne"), password: val("tm-np") });
    else if (a === "tog") act("setActive", { id: id, active: v === "1" });
    else if (a === "rp") { var p = prompt("New login password for " + b.getAttribute("data-e")); if (p) act("resetPassword", { id: id, password: p }); }
    else if (a === "blk") { if (v && confirm("Block " + k + ": " + v + " ? Iske saare sessions band ho jayenge. Apna hi IP block mat karna.")) act("block", { kind: k, value: v }); }
    else if (a === "unb") act("unblock", { kind: k, value: v });
    else if (a === "kwadd") kwAdd();
    else if (a === "kwdel") { var ix = +b.getAttribute("data-i"); kwEdit(function (list) { if (list[ix]) list.splice(ix, 1); else return false; }); }
    else if (a === "nadd") addNiche();
    else if (a === "nren") {
      var cn = byId(cfgNow().niches, selN);
      var nv = cn && prompt("Niche ka naya naam", cn.name);
      if (nv && nv.trim()) cfgEdit(function (cfg) { var n = byId(cfg.niches, selN); if (!n) return false; n.name = nv.trim(); });
    }
    else if (a === "ndel") {
      if (byId(cfgNow().niches, selN) && confirm("Ye niche aur uske saare keywords delete honge, aur clients se bhi hat jayega. Pakka?"))
        cfgEdit(function (cfg) {
          cfg.niches = cfg.niches.filter(function (n) { return n.id !== selN; });
          cfg.clients.forEach(function (c) { c.niches = (c.niches || []).filter(function (x) { return x !== selN; }); });
        });
    }
    else if (a === "sadd") { ed = { t: "style", id: null }; setupRender(); }
    else if (a === "sedit") { ed = { t: "style", id: id }; setupRender(); }
    else if (a === "ssave") saveStyle();
    else if (a === "sdel") {
      if (confirm("Ye style delete karein? Clients se bhi hat jayega."))
        cfgEdit(function (cfg) {
          cfg.styles = cfg.styles.filter(function (s) { return s.id !== id; });
          cfg.clients.forEach(function (c) { c.styles = (c.styles || []).filter(function (x) { return x !== id; }); });
        });
    }
    else if (a === "cadd") { ed = { t: "client", id: null }; setupRender(); }
    else if (a === "cedit") { ed = { t: "client", id: id }; setupRender(); }
    else if (a === "csave") saveClient();
    else if (a === "cdel") {
      if (confirm("Ye client delete karein?")) cfgEdit(function (cfg) { cfg.clients = cfg.clients.filter(function (c) { return c.id !== id; }); });
    }
    else if (a === "ecancel") { ed = null; setupRender(); }
    else if (a === "cfg") {
      var d;
      try { d = JSON.parse(val("tm-cfg")); } catch (x) { return alert("JSON galat hai: " + x.message); }
      act("saveConfig", { data: d });
    }
  });

  // ---------- easy setup: niches, keywords, styles, clients (admin) ----------
  var selN = "", ed = null;
  var PL = { 2: "TOP", 1: "GOOD", 0: "OK" };
  var TXL = { none: "Image par koi text nahi", headline: "Sirf headline", points: "Headline + 3 chhote points", ad: "Headline + Shop Now (ad style)" };
  function byId(list, id) { return (list || []).filter(function (x) { return x.id === id; })[0]; }
  function cfgNow() { return (cache && cache.cfg) || {}; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function nid(list, pre) { var id; do { id = pre + Math.random().toString(36).slice(2, 6); } while (byId(list, id)); return id; }
  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (sel ? " selected" : "") + ">" + esc(label) + "</option>"; }
  function checks(name, list, picked) {
    if (!list.length) return '<span class="note">Abhi koi nahi hai, upar pehle bana lo.</span>';
    return list.map(function (x) {
      return '<label style="display:inline-block;margin:4px 14px 4px 0;font-size:13px"><input type="checkbox" name="' + name + '" value="' + esc(x.id) + '"' + (picked.indexOf(x.id) > -1 ? " checked" : "") + ' style="width:auto"> ' + esc(x.name) + "</label>";
    }).join("");
  }
  function cfgEdit(fn, ok) {
    var cfg = clone(cfgNow());
    cfg.clients = cfg.clients || []; cfg.niches = cfg.niches || []; cfg.styles = cfg.styles || [];
    if (fn(cfg) === false) return;
    return api("saveConfig", { data: cfg }).then(function () {
      cache.cfg = cfg;
      if (ok) ok();
      var ta = root.querySelector("#tm-cfg");
      if (ta) ta.value = JSON.stringify(cfg, null, 1);
      setupRender();
      if (window.mountPW) window.mountPW(root.querySelector("#tm-pw"), api, cfg);
    }).catch(function (e) { alert(e.message); });
  }
  function box() { return { border: "border:1px solid var(--line);border-radius:8px;padding:12px;margin:10px 0" }; }

  function styleForm() {
    var s = (ed.id && byId(cfgNow().styles, ed.id)) || {};
    return '<div style="' + box().border + '"><b>' + (ed.id ? "Style edit karo" : "Naya style") + "</b>" +
      '<label class="note">Style ka naam</label><input id="su-sn" value="' + esc(s.name || "") + '" placeholder="Lifestyle Scene" style="width:100%">' +
      '<label class="note">Style kaisa dikhna chahiye (ye AI ko bheja jata hai)</label><textarea id="su-sd" placeholder="Product cozy ghar ke setting me, natural light, warm colors" style="width:100%;min-height:70px">' + esc(s.desc || "") + "</textarea>" +
      '<label class="note">Image par text</label><select id="su-st">' + Object.keys(TXL).map(function (k) { return opt(k, TXL[k], (s.tx || "none") === k); }).join("") + "</select>" +
      '<p><button class="btn primary" data-a="ssave">Save style</button> <button class="btn" data-a="ecancel">Cancel</button></p></div>';
  }
  function clientForm() {
    var cfg = cfgNow();
    var c = (ed.id && byId(cfg.clients, ed.id)) || {};
    return '<div style="' + box().border + '"><b>' + (ed.id ? "Client edit karo" : "Naya client") + "</b>" +
      '<label class="note">Client / shop ka naam</label><input id="su-cn" value="' + esc(c.name || "") + '" placeholder="Shop name" style="width:100%">' +
      '<label class="note">Target country</label><input id="su-cc" value="' + esc(c.country || "USA") + '" style="width:100%">' +
      '<label class="note">Ek listing par kitne pin variations</label><select id="su-cp">' + [1, 2, 3, 4, 5, 6].map(function (n) { return opt(n, String(n), (c.n || 3) === n); }).join("") + "</select>" +
      '<label class="note">Niches (tick karo)</label><div>' + checks("su-cnn", cfg.niches || [], c.niches || []) + "</div>" +
      '<label class="note">Pin styles (tick karo)</label><div>' + checks("su-css", cfg.styles || [], c.styles || []) + "</div>" +
      '<label class="note">Client notes (optional, AI ko dikhte hain)</label><textarea id="su-cno" style="width:100%;min-height:60px">' + esc(c.notes || "") + "</textarea>" +
      '<p><button class="btn primary" data-a="csave">Save client</button> <button class="btn" data-a="ecancel">Cancel</button></p></div>';
  }

  function setupRender() {
    var host = root.querySelector("#tm-setup");
    if (!host) return;
    var cfg = cfgNow(), ns = cfg.niches || [], cl = cfg.clients || [], st = cfg.styles || [];
    if (!byId(ns, selN)) selN = ns.length ? ns[0].id : "";
    function nameOf(list, ids) { return (ids || []).map(function (i) { var x = byId(list, i); return x ? x.name : ""; }).filter(Boolean).join(", "); }
    var h = '<h3>Setup (yahin se sab kuch manage hota hai)</h3><p class="note">Order: pehle Niche + keywords banao, phir Pin styles, phir Client banao aur usme niche/style tick karo. Har change apne aap save hota hai.</p>';

    // niches + keywords
    h += "<h3>1. Niches aur keywords</h3>";
    h += '<p class="note">Niche = product category (jaise Jewelry, Home Decor). Keywords niche ke hote hain aur us niche wale saare clients ke pins me use hote hain.</p>';
    h += '<input id="su-nn" placeholder="Naye niche ka naam" style="width:100%;max-width:300px"> <button class="btn primary" data-a="nadd">Add niche</button>';
    if (ns.length) {
      h += '<label class="note">Niche chuno (bracket me dikhta hai kaun se clients use karte hain)</label><select id="su-ns">' + ns.map(function (n) {
        var users = cl.filter(function (c) { return (c.niches || []).indexOf(n.id) > -1; }).map(function (c) { return c.name; });
        return opt(n.id, n.name + " (" + (users.length ? users.join(", ") : "koi client nahi") + ")", n.id === selN);
      }).join("") + '</select> <button class="btn" data-a="nren">Rename</button> <button class="btn danger" data-a="ndel">Delete niche</button>';
      var n = byId(ns, selN), kws = n.kw || [];
      var users2 = cl.filter(function (c) { return c.id && (c.niches || []).indexOf(n.id) > -1; });
      if (users2.length > 1) h += '<p class="note">Dhyan do: ye niche ' + users2.length + " clients ke saath shared hai, keyword badloge to sabke pins par asar padega.</p>";
      h += '<div class="tablewrap"><table><thead><tr><th>Keyword</th><th>Priority</th><th></th></tr></thead><tbody>';
      kws.forEach(function (k, i) {
        var pr = k.p === 2 || k.p === 1 ? k.p : 0;
        h += "<tr><td>" + esc(k.k) + '</td><td><select data-kwp="' + i + '">' + [2, 1, 0].map(function (v) { return opt(v, PL[v], v === pr); }).join("") + '</select></td><td><button class="btn danger" data-a="kwdel" data-i="' + i + '">Remove</button></td></tr>';
      });
      if (!kws.length) h += '<tr><td colspan="3" class="empty">Abhi koi keyword nahi. Neeche type karke add karo.</td></tr>';
      h += "</tbody></table></div>";
      h += '<input id="tm-kwin" placeholder="Keywords likho (comma se alag karo)" style="width:100%;max-width:380px"> <select id="tm-kwp" style="width:auto"><option value="2">TOP</option><option value="1" selected>GOOD</option><option value="0">OK</option></select> <button class="btn primary" data-a="kwadd">Add keywords</button>';
    }

    // styles
    h += "<h3>2. Pin styles</h3>";
    h += '<div class="tablewrap"><table><thead><tr><th>Naam</th><th>Description</th><th>Image text</th><th></th></tr></thead><tbody>';
    st.forEach(function (s) {
      h += "<tr><td>" + esc(s.name) + "</td><td>" + esc((s.desc || "").slice(0, 80)) + "</td><td>" + esc(TXL[s.tx || "none"] || s.tx) + '</td><td><button class="btn" data-a="sedit" data-id="' + esc(s.id) + '">Edit</button> <button class="btn danger" data-a="sdel" data-id="' + esc(s.id) + '">Delete</button></td></tr>';
    });
    if (!st.length) h += '<tr><td colspan="4" class="empty">Koi style nahi.</td></tr>';
    h += "</tbody></table></div>";
    h += ed && ed.t === "style" ? styleForm() : '<button class="btn primary" data-a="sadd">+ Naya style</button>';

    // clients
    h += "<h3>3. Clients</h3>";
    h += '<div class="tablewrap"><table><thead><tr><th>Client</th><th>Country</th><th>Pins</th><th>Niches</th><th>Styles</th><th></th></tr></thead><tbody>';
    cl.forEach(function (c) {
      h += "<tr><td>" + esc(c.name) + "</td><td>" + esc(c.country) + "</td><td>" + esc(c.n || 3) + "</td><td>" + esc(nameOf(ns, c.niches)) + "</td><td>" + esc(nameOf(st, c.styles)) + '</td><td><button class="btn" data-a="cedit" data-id="' + esc(c.id) + '">Edit</button> <button class="btn danger" data-a="cdel" data-id="' + esc(c.id) + '">Delete</button></td></tr>';
    });
    if (!cl.length) h += '<tr><td colspan="6" class="empty">Koi client nahi.</td></tr>';
    h += "</tbody></table></div>";
    h += ed && ed.t === "client" ? clientForm() : '<button class="btn primary" data-a="cadd">+ Naya client</button>';
    host.innerHTML = h;
  }

  function sv(id) { var e = root.querySelector("#" + id); return e ? e.value : ""; }
  function picked(name) { return [].slice.call(root.querySelectorAll('input[name="' + name + '"]:checked')).map(function (x) { return x.value; }); }
  function kwEdit(fn) {
    cfgEdit(function (cfg) {
      var n = byId(cfg.niches, selN);
      if (!n) return false;
      if (!Array.isArray(n.kw)) n.kw = [];
      return fn(n.kw);
    });
  }
  function kwAdd() {
    var pr = parseInt(sv("tm-kwp"), 10) || 0;
    var words = sv("tm-kwin").split(/[,\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!words.length) return;
    kwEdit(function (list) {
      var have = list.map(function (k) { return String(k.k).toLowerCase(); }), added = 0;
      words.forEach(function (w) {
        if (have.indexOf(w.toLowerCase()) > -1) return;
        have.push(w.toLowerCase()); list.push({ k: w, p: pr }); added++;
      });
      if (!added) { alert("Ye keywords already hain."); return false; }
    });
  }
  function addNiche() {
    var name = sv("su-nn").trim();
    if (!name) return alert("Niche ka naam likho.");
    cfgEdit(function (cfg) {
      if (cfg.niches.some(function (n) { return n.name.toLowerCase() === name.toLowerCase(); })) { alert("Ye niche already hai."); return false; }
      var id = nid(cfg.niches, "n");
      cfg.niches.push({ id: id, name: name, kw: [] });
      selN = id;
    });
  }
  function saveStyle() {
    var name = sv("su-sn").trim();
    if (!name) return alert("Style ka naam likho.");
    var o = { name: name, desc: sv("su-sd").trim(), tx: sv("su-st") || "none" };
    cfgEdit(function (cfg) {
      if (ed.id) { var s = byId(cfg.styles, ed.id); if (!s) return false; Object.keys(o).forEach(function (k) { s[k] = o[k]; }); }
      else { o.id = nid(cfg.styles, "s"); cfg.styles.push(o); }
    }, function () { ed = null; });
  }
  function saveClient() {
    var name = sv("su-cn").trim();
    if (!name) return alert("Client ka naam likho.");
    var nn = picked("su-cnn"), ss = picked("su-css");
    if (!nn.length || !ss.length) return alert("Kam se kam ek niche aur ek style tick karo.");
    var o = { name: name, country: sv("su-cc").trim() || "USA", n: parseInt(sv("su-cp"), 10) || 3, notes: sv("su-cno").trim(), niches: nn, styles: ss };
    cfgEdit(function (cfg) {
      if (ed.id) { var c = byId(cfg.clients, ed.id); if (!c) return false; Object.keys(o).forEach(function (k) { c[k] = o[k]; }); }
      else { o.id = nid(cfg.clients, "c"); cfg.clients.push(o); }
    }, function () { ed = null; });
  }

  root.addEventListener("change", function (e) {
    var t = e.target;
    if (t.id === "su-ns") { selN = t.value; setupRender(); }
    else if (t.hasAttribute && t.hasAttribute("data-kwp")) {
      var i = +t.getAttribute("data-kwp"), v = parseInt(t.value, 10) || 0;
      kwEdit(function (list) { if (list[i]) list[i].p = v; else return false; });
    }
  });
  root.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    if (e.target.id === "tm-kwin") { e.preventDefault(); kwAdd(); }
    else if (e.target.id === "su-nn") { e.preventDefault(); addNiche(); }
  });

  // ---------- employee view (only Pin Writer, no admin controls) ----------
  function unlockView(msg) {
    root.innerHTML = '<label class="note">Work password (admin se lo)</label><input id="tm-w" type="password" style="width:100%;max-width:360px">' +
      '<p><button class="btn primary" id="tm-unlock">Unlock</button></p><div class="note" id="tm-uer" style="color:var(--pin)"></div>';
    root.querySelector("#tm-uer").textContent = msg || "";
    root.querySelector("#tm-unlock").onclick = function () {
      api("unlock", { password: root.querySelector("#tm-w").value })
        .then(function () { employeeView(); })
        .catch(function () { unlockView("Work password galat hai ya abhi set nahi hua."); });
    };
  }
  function employeeView() {
    root.innerHTML = '<p class="note">Loading...</p>';
    api("boot").then(function (d) {
      if (!d.unlocked) return unlockView();
      root.innerHTML = '<div id="tm-pw"></div>';
      window.mountPW(root.querySelector("#tm-pw"), api, d.cfg || {});
    }).catch(function () {
      root.innerHTML = '<p class="note">Session khatam ho gaya. Page reload karke dobara login karo.</p>';
    });
  }

  // called by index.html router when the Team tab opens
  window.teamTabOpen = function (role) {
    if (role === "admin") load(); else employeeView();
  };
})();
