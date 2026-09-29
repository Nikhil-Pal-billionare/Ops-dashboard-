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

    h += "<h3>Keywords</h3><div id=\"tm-kw\"></div>";
    h += "<h3>Clients, niches and pin styles (JSON)</h3>";
    h += '<p class="note">Client: {"id":"c1","name":"Shop","country":"USA","niches":["n1"],"styles":["s1","s2"],"n":3,"notes":""}. Keyword p: 2 = top, 1 = good, 0 = normal.</p>';
    h += '<textarea id="tm-cfg" style="width:100%;min-height:340px;font-family:monospace;font-size:12px">' + esc(JSON.stringify(d.cfg, null, 1)) + '</textarea><p><button class="btn primary" data-a="cfg">Save config</button></p>';
    root.innerHTML = h;
    kwRender();
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
    else if (a === "cfg") {
      var d;
      try { d = JSON.parse(val("tm-cfg")); } catch (x) { return alert("JSON galat hai: " + x.message); }
      act("saveConfig", { data: d });
    }
  });

  // ---------- keyword manager (admin) ----------
  var kwC = "", kwN = "";
  var PL = { 2: "TOP", 1: "GOOD", 0: "OK" };
  function byId(list, id) { return (list || []).filter(function (x) { return x.id === id; })[0]; }
  function kwSave(cfg) {
    return api("saveConfig", { data: cfg }).then(function () {
      cache.cfg = cfg;
      var ta = root.querySelector("#tm-cfg");
      if (ta) ta.value = JSON.stringify(cfg, null, 1);
      kwRender();
    }).catch(function (e) { alert(e.message); });
  }
  function kwRender() {
    var box = root.querySelector("#tm-kw");
    if (!box) return;
    var cfg = (cache && cache.cfg) || {};
    var cl = cfg.clients || [], ns = cfg.niches || [];
    if (!cl.length) { box.innerHTML = '<p class="note">Pehle neeche config me kam se kam ek client add karo.</p>'; return; }
    if (!byId(cl, kwC)) kwC = cl[0].id;
    var c = byId(cl, kwC);
    var cn = ns.filter(function (n) { return (c.niches || []).indexOf(n.id) > -1; });
    var h = '<label class="note">Client</label><select id="tm-kwc">' + cl.map(function (x) {
      return '<option value="' + esc(x.id) + '"' + (x.id === kwC ? " selected" : "") + ">" + esc(x.name) + "</option>";
    }).join("") + "</select>";
    if (!cn.length) {
      box.innerHTML = h + '<p class="note">Is client ko koi niche assign nahi hai. Neeche config me client ke "niches" me niche id daalo.</p>';
      return;
    }
    if (!byId(cn, kwN)) kwN = cn[0].id;
    var n = byId(cn, kwN);
    h += '<label class="note">Niche</label><select id="tm-kwn">' + cn.map(function (x) {
      return '<option value="' + esc(x.id) + '"' + (x.id === kwN ? " selected" : "") + ">" + esc(x.name) + "</option>";
    }).join("") + "</select>";
    var shared = cl.filter(function (x) { return x.id !== kwC && (x.niches || []).indexOf(kwN) > -1; });
    if (shared.length) {
      h += '<p class="note">Dhyan do: ye niche in clients ke saath shared hai: <b>' + esc(shared.map(function (x) { return x.name; }).join(", ")) + "</b>. Keyword badloge to unke pins par bhi asar padega.</p>";
    }
    var kws = n.kw || [];
    h += '<div class="tablewrap"><table><thead><tr><th>Keyword</th><th>Priority</th><th></th></tr></thead><tbody>';
    kws.forEach(function (k, i) {
      var pr = k.p === 2 || k.p === 1 ? k.p : 0;
      h += "<tr><td>" + esc(k.k) + '</td><td><select data-kwp="' + i + '">' + [2, 1, 0].map(function (v) {
        return '<option value="' + v + '"' + (v === pr ? " selected" : "") + ">" + PL[v] + "</option>";
      }).join("") + '</select></td><td><button class="btn danger" data-a="kwdel" data-i="' + i + '">Remove</button></td></tr>';
    });
    if (!kws.length) h += '<tr><td colspan="3" class="empty">Is niche me abhi koi keyword nahi hai.</td></tr>';
    h += "</tbody></table></div>";
    h += '<input id="tm-kwin" placeholder="Keywords (comma se alag karo)" style="width:100%;max-width:420px"> ' +
      '<select id="tm-kwp" style="width:auto"><option value="2">TOP</option><option value="1" selected>GOOD</option><option value="0">OK</option></select> ' +
      '<button class="btn primary" data-a="kwadd">Add</button>';
    box.innerHTML = h;
  }
  function kwEdit(fn) {
    var cfg = JSON.parse(JSON.stringify((cache && cache.cfg) || {}));
    var n = byId(cfg.niches, kwN);
    if (!n) return;
    if (!Array.isArray(n.kw)) n.kw = [];
    if (fn(n.kw) === false) return;
    kwSave(cfg);
  }
  function kwAdd() {
    var inp = root.querySelector("#tm-kwin");
    var pr = parseInt(root.querySelector("#tm-kwp").value, 10) || 0;
    var words = inp.value.split(/[,\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!words.length) return;
    kwEdit(function (list) {
      var have = list.map(function (k) { return String(k.k).toLowerCase(); });
      var added = 0;
      words.forEach(function (w) {
        if (have.indexOf(w.toLowerCase()) > -1) return;
        have.push(w.toLowerCase());
        list.push({ k: w, p: pr });
        added++;
      });
      if (!added) { alert("Ye keywords already hain."); return false; }
    });
  }
  root.addEventListener("change", function (e) {
    var t = e.target;
    if (t.id === "tm-kwc") { kwC = t.value; kwN = ""; kwRender(); }
    else if (t.id === "tm-kwn") { kwN = t.value; kwRender(); }
    else if (t.hasAttribute && t.hasAttribute("data-kwp")) {
      var i = +t.getAttribute("data-kwp"), v = parseInt(t.value, 10) || 0;
      kwEdit(function (list) { if (list[i]) list[i].p = v; else return false; });
    }
  });
  root.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.id === "tm-kwin") { e.preventDefault(); kwAdd(); }
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
