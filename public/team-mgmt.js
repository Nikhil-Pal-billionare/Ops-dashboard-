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

    h += "<h3>Clients, niches and pin styles (JSON)</h3>";
    h += '<p class="note">Client: {"id":"c1","name":"Shop","country":"USA","niches":["n1"],"styles":["s1","s2"],"n":3,"notes":""}. Keyword p: 2 = top, 1 = good, 0 = normal.</p>';
    h += '<textarea id="tm-cfg" style="width:100%;min-height:340px;font-family:monospace;font-size:12px">' + esc(JSON.stringify(d.cfg, null, 1)) + '</textarea><p><button class="btn primary" data-a="cfg">Save config</button></p>';
    root.innerHTML = h;
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
    else if (a === "cfg") {
      var d;
      try { d = JSON.parse(val("tm-cfg")); } catch (x) { return alert("JSON galat hai: " + x.message); }
      act("saveConfig", { data: d });
    }
  });

  document.getElementById("tabs").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-tab]");
    if (b && b.getAttribute("data-tab") === "team") load();
  });
})();
