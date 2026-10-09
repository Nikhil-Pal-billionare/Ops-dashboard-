// CA Lite tab: P&L, ROI target, daily SIP, balance sheet, tax estimate.
// Income/expense comes from the same finance entries as the Business tab (no double entry).
// Settings live in state.ca and sync to cloud with the rest of the dashboard.
(function () {
  "use strict";
  var root = null, ctx = null, sub = "pl";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function n(v) { var x = parseFloat(v); return isFinite(x) ? x : 0; }
  function rs(v) { return "Rs " + Math.round(n(v)).toLocaleString("en-IN"); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function dayNum(s) { var d = new Date(s + "T00:00:00Z"); return Math.floor(d.getTime() / 864e5); }

  function S() { return ctx.state(); }
  function C() {
    var st = S();
    if (!st.ca || typeof st.ca !== "object") st.ca = {};
    var c = st.ca;
    if (c.oc == null) c.oc = 0;
    if (c.li == null) c.li = 0;
    if (c.as == null) c.as = 0;
    if (!c.tg) c.tg = 200;
    if (!c.sp || typeof c.sp !== "object") c.sp = {};
    if (c.sp.s == null) c.sp.s = "";
    if (c.sp.g == null) c.sp.g = 100;
    if (c.sp.b == null) c.sp.b = 100;
    if (c.sp.m == null) c.sp.m = 0;
    if (!Array.isArray(c.sp.w)) c.sp.w = [];
    return c;
  }
  function fin() { return Array.isArray(S().finance) ? S().finance : []; }

  function kpi(label, val, cls) {
    return '<div class="ca-k"><span class="k">' + esc(label) + '</span><b class="' + (cls || "") + '">' + val + "</b></div>";
  }
  function bar(pc, big) {
    var w = Math.max(0, Math.min(100, pc));
    return '<div class="ca-bar' + (big ? " big" : "") + '"><i class="' + (pc >= 100 ? "ok" : "") + '" style="width:' + w + '%"></i></div>';
  }
  function gl(v) { return v >= 0 ? "gain" : "loss"; }

  // ---------- calculations ----------
  function totals() {
    var m = today().slice(0, 7), r = { mi: 0, me: 0, ti: 0, te: 0, V: {} };
    fin().forEach(function (f) {
      var a = n(f.amount), inc = f.type === "revenue", src = f.source || "Other";
      if (inc) r.ti += a; else r.te += a;
      if (String(f.date).slice(0, 7) === m) { if (inc) r.mi += a; else r.me += a; }
      r.V[src] = r.V[src] || { i: 0, e: 0 };
      if (inc) r.V[src].i += a; else r.V[src].e += a;
    });
    return r;
  }
  function sip() {
    var P = C().sp, t = today(), days = 0, mdays = 0;
    if (P.s) {
      days = dayNum(t) - dayNum(P.s) + 1;
      if (days < 0) days = 0;
      days = Math.max(0, days - n(P.m));
      var ms = t.slice(0, 8) + "01", from = P.s > ms ? P.s : ms;
      mdays = Math.max(0, dayNum(t) - dayNum(from) + 1);
    }
    var ug = 0, ub = 0;
    P.w.forEach(function (x) { if (x.f === "g") ug += n(x.a); else ub += n(x.a); });
    var sg = days * n(P.g), sb = days * n(P.b);
    return { days: days, sg: sg, sb: sb, ug: ug, ub: ub, bg: sg - ug, bb: sb - ub, month: mdays * (n(P.g) + n(P.b)) };
  }
  function fyStart() {
    var d = new Date(), y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    return y + "-04-01";
  }
  function taxCalc(i) {
    var sl = [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15], [2000000, 0.20], [2400000, 0.25], [1e15, 0.30]], t = 0, p = 0;
    if (i <= 1200000) return 0;
    for (var j = 0; j < sl.length; j++) { var u = sl[j][0]; if (i > p) t += (Math.min(i, u) - p) * sl[j][1]; p = u; }
    return t * 1.04;
  }

  // ---------- views ----------
  function viewPL() {
    var T = totals(), Q = sip(), c = C(), h = "";
    var mp = T.mi - T.me, ap = mp - Q.month;
    h += "<h3 style=\"margin-top:0\">Is mahine ka P&amp;L</h3><div class=\"ca-g\">" +
      kpi("Income", rs(T.mi), "gain") + kpi("Expense", rs(T.me), "loss") + kpi("Profit", rs(mp), gl(mp)) +
      kpi("Margin", T.mi ? Math.round(mp / T.mi * 100) + "%" : "-") +
      (c.sp.s ? kpi("SIP gaya (is mahine)", rs(Q.month)) + kpi("Profit after SIP", rs(ap), gl(ap)) : "") + "</div>";
    if (c.sp.s) {
      h += ap < 0
        ? '<div class="note" style="color:var(--loss)">Dhyan do: is mahine ka profit SIP se kam hai. SIP ka paisa business ke capital se kat raha hai, profit se nahi. Ya income badhao ya kharcha kaato.</div>'
        : '<div class="note" style="color:var(--gain)">Badhiya: SIP poora business profit se cover ho raha hai.</div>';
    }

    var keys = Object.keys(T.V).sort(), tg = n(c.tg) || 200, mult = 1 + tg / 100;
    h += "<h3>Business-wise ROI (all time)</h3>";
    if (!keys.length) {
      h += '<div class="empty">Abhi koi revenue/expense entry nahi hai. Neeche "Quick entry" se ya Add data tab se daalo.</div>';
    } else {
      h += '<div class="tablewrap"><table><thead><tr><th>Business</th><th>Income</th><th>Expense</th><th>Profit</th><th>ROI</th></tr></thead><tbody>';
      keys.forEach(function (k) {
        var o = T.V[k], p = o.i - o.e;
        h += "<tr><td>" + esc(k) + "</td><td>" + rs(o.i) + "</td><td>" + rs(o.e) + '</td><td style="color:var(--' + gl(p) + ')">' + rs(p) + "</td><td>" + (o.e ? Math.round(p / o.e * 100) + "%" : "-") + "</td></tr>";
      });
      h += "</tbody></table></div>";
    }
    h += '<div class="note">ROI % = (Income - Expense) / Expense x 100. SIP expense nahi hai (paisa tumhara hi hai, bas alag rakha hai), isliye ROI aur tax me nahi juda.</div>';

    h += "<h3>ROI target tracker</h3>";
    h += '<div class="toolbar"><label style="flex-direction:row;align-items:center;gap:8px">Target ROI (%) <input id="ca-tg" type="number" inputmode="decimal" value="' + tg + '" style="width:110px"></label></div>';
    if (T.te) {
      var oT = T.te * mult, gap = Math.max(0, oT - T.ti), roi = (T.ti - T.te) / T.te * 100, pc = oT ? T.ti / oT * 100 : 0, mx = T.ti / mult, cut = Math.max(0, T.te - mx);
      h += '<div class="ca-g">' + kpi("Target ROI", tg + "%") + kpi("Abhi ROI", Math.round(roi) + "%", roi >= tg ? "gain" : "loss") +
        kpi("Target income", rs(oT)) + kpi("Abhi income", rs(T.ti)) + kpi("Baaki income", gap ? rs(gap) : "Done", gap ? "loss" : "gain") +
        kpi("Max kharcha (abhi ke income pe)", rs(mx)) + kpi("Kitna kharcha kaatna", cut ? rs(cut) : "Kuch nahi", cut ? "loss" : "gain") + "</div>";
      h += '<div class="note">Overall progress: ' + Math.round(pc) + "% " + (pc >= 100 ? "(target hit)" : "(target tak " + Math.round(100 - pc) + "% baaki)") + "</div>" + bar(pc, true);
      h += '<div class="tablewrap" style="margin-top:14px"><table><thead><tr><th>Business</th><th>ROI</th><th>Target income</th><th>Baaki</th><th>Max kharcha</th><th>Progress</th></tr></thead><tbody>';
      keys.forEach(function (k) {
        var o = T.V[k];
        if (!o.e) { h += "<tr><td>" + esc(k) + '</td><td>-</td><td>-</td><td style="color:var(--gain)">No expense</td><td>-</td><td>' + bar(100) + "</td></tr>"; return; }
        var t2 = o.e * mult, g2 = Math.max(0, t2 - o.i), p2 = o.i / t2 * 100, r2 = (o.i - o.e) / o.e * 100;
        h += "<tr><td>" + esc(k) + '</td><td style="color:var(--' + (r2 >= tg ? "gain" : "loss") + ')">' + Math.round(r2) + "%</td><td>" + rs(t2) + '</td><td style="color:var(--' + (g2 ? "loss" : "gain") + ')">' + (g2 ? rs(g2) : "Done") + "</td><td>" + rs(o.i / mult) + "</td><td>" + bar(p2) + '<span class="note">' + Math.round(p2) + "%</span></td></tr>";
      });
      h += "</tbody></table></div>";
    } else {
      h += '<div class="note">Pehle kuch expense entries daalo, tab target dikhega.</div>';
    }
    h += '<div class="note">Target income = Expense x (1 + Target/100). 200% ROI matlab har Rs 1 lagao to Rs 3 wapas. Max kharcha = abhi ke income pe target hit karne ke liye expense kitna tak hona chahiye.</div>';

    h += "<h3>Quick entry</h3>";
    var srcs = {};
    ["GrowMyPin", "InfimagenAI", "MoonWeaves", "CourseMarket"].concat(fin().map(function (f) { return f.source || ""; })).forEach(function (s) { if (s) srcs[s] = 1; });
    h += '<div class="formgrid">' +
      '<label>Type<select id="ca-ft"><option value="revenue">Income (aaya)</option><option value="expense">Expense (gaya)</option></select></label>' +
      '<label>Date<input id="ca-fd" type="date" value="' + today() + '"></label>' +
      '<label>Amount (Rs)<input id="ca-fa" type="number" min="0" inputmode="decimal"></label>' +
      '<label>Business / source<input id="ca-fs" list="ca-srcs" placeholder="GrowMyPin"></label></div>' +
      '<datalist id="ca-srcs">' + Object.keys(srcs).map(function (s) { return '<option value="' + esc(s) + '">'; }).join("") + "</datalist>" +
      '<button class="btn primary" data-ca="addfin">Save entry</button>' +
      '<div class="note">Yeh entry Business tab aur Add data wali finance list me hi jaati hai, alag se do baar daalne ki zarurat nahi.</div>';
    return h;
  }

  function viewSIP() {
    var c = C(), P = c.sp, Q = sip(), T = totals(), h = "";
    h += '<h3 style="margin-top:0">Daily SIP setup</h3><div class="formgrid">' +
      '<label>SIP start date<input id="ca-ss" type="date" value="' + esc(P.s) + '"></label>' +
      '<label>Business Growth / din (Rs)<input id="ca-sg" type="number" inputmode="decimal" value="' + n(P.g) + '"></label>' +
      '<label>Buffer / din (Rs)<input id="ca-sb" type="number" inputmode="decimal" value="' + n(P.b) + '"></label>' +
      '<label>Miss hue din<input id="ca-sm" type="number" inputmode="numeric" value="' + (n(P.m) || "") + '" placeholder="0"></label></div>';
    h += '<div class="note">Dono SIP ka paisa business income se jaata hai. Roz apne aap judta hai: start date se aaj tak ke din x daily amount. Kisi din SIP nahi kata to "Miss hue din" badha do.</div>';

    h += "<h3>Fund status</h3>";
    if (!P.s) {
      h += '<div class="note">Upar SIP start date daalo, tab hisaab shuru hoga.</div>';
    } else {
      h += '<div class="ca-g">' + kpi("SIP chalte din", Q.days) + kpi("Growth fund balance", rs(Q.bg), gl(Q.bg)) + kpi("Buffer balance", rs(Q.bb), gl(Q.bb)) +
        kpi("Total SIP balance", rs(Q.bg + Q.bb)) + kpi("Growth jama (total)", rs(Q.sg)) + kpi("Growth use kiya", rs(Q.ug)) +
        kpi("Buffer jama (total)", rs(Q.sb)) + kpi("Buffer use kiya", rs(Q.ub)) +
        kpi("Har mahine jama", rs((n(P.g) + n(P.b)) * 30)) + kpi("1 saal me jama", rs((n(P.g) + n(P.b)) * 365)) + "</div>";
      var goal = T.me * 3;
      h += goal
        ? '<div class="note">Buffer goal (3 mahine ka kharcha ' + rs(goal) + "): " + Math.round(Q.bb / goal * 100) + "%</div>" + bar(Q.bb / goal * 100, true)
        : '<div class="note">Is mahine ke expense entries daalo, tab buffer goal (3 mahine ka kharcha) dikhega.</div>';
    }

    h += "<h3>Fund se nikala</h3><div class=\"formgrid\">" +
      '<label>Date<input id="ca-wd" type="date" value="' + today() + '"></label>' +
      '<label>Fund<select id="ca-wf"><option value="g">Business Growth</option><option value="b">Buffer</option></select></label>' +
      '<label>Amount (Rs)<input id="ca-wa" type="number" min="0" inputmode="decimal"></label>' +
      '<label>Kis liye<input id="ca-wn"></label></div>' +
      '<button class="btn primary" data-ca="addw">Add</button>';
    if (P.w.length) {
      h += '<div class="tablewrap" style="margin-top:12px"><table><thead><tr><th>Date</th><th>Fund</th><th>Amount</th><th>Kis liye</th><th></th></tr></thead><tbody>';
      P.w.map(function (x, i) { return i; }).reverse().forEach(function (i) {
        var x = P.w[i];
        h += "<tr><td>" + esc(x.d) + "</td><td>" + (x.f === "g" ? "Growth" : "Buffer") + '</td><td style="color:var(--loss)">-' + rs(x.a) + "</td><td>" + esc(x.n || "") + '</td><td><button class="rowbtn" data-ca="delw" data-i="' + i + '" aria-label="Delete">x</button></td></tr>';
      });
      h += "</tbody></table></div>";
    }
    h += '<div class="note">Growth fund se ads/tools pe kharcha kiya to yahan bhi daalo aur expense entry bhi daalo, tabhi ROI aur cash dono sahi aayenge. Buffer sirf emergency ke liye, 3 mahine ke kharche jitna hone tak mat chhuo.</div>';
    return h;
  }

  function viewBS() {
    var c = C(), T = totals(), Q = sip(), h = "";
    var cash = n(c.oc) + T.ti - T.te, eq = cash + n(c.as) - n(c.li);
    h += '<h3 style="margin-top:0">Balance sheet (simple)</h3><div class="formgrid">' +
      '<label>Opening cash (Rs)<input id="ca-oc" type="number" inputmode="decimal" value="' + (n(c.oc) || "") + '"></label>' +
      '<label>Udhaar / liabilities (Rs)<input id="ca-li" type="number" inputmode="decimal" value="' + (n(c.li) || "") + '"></label>' +
      '<label>Other assets (Rs)<input id="ca-as" type="number" inputmode="decimal" value="' + (n(c.as) || "") + '"></label></div>';
    h += '<div class="ca-g">' + kpi("Cash (calc)", rs(cash), gl(cash)) + kpi("Total assets", rs(cash + n(c.as))) + kpi("Liabilities", rs(c.li)) + kpi("Equity", rs(eq), gl(eq)) +
      (c.sp.s ? kpi("SIP me band", rs(Q.bg + Q.bb)) + kpi("Free cash (SIP ke baad)", rs(cash - Q.bg - Q.bb), gl(cash - Q.bg - Q.bb)) : "") + "</div>";
    h += '<div class="note">Cash = opening cash + total income - total expense. Equity (net worth) = assets - liabilities. Free cash = asli kharch karne layak paisa.</div>';

    var fs = fyStart(), fi = 0, fe = 0;
    fin().forEach(function (f) { if (String(f.date) >= fs) { if (f.type === "revenue") fi += n(f.amount); else fe += n(f.amount); } });
    var now = new Date(), mo = (now.getFullYear() - +fs.slice(0, 4)) * 12 + now.getMonth() - 3 + 1;
    var ytd = fi - fe, proj = Math.max(0, ytd / mo * 12), tax = taxCalc(proj);
    h += "<h3>Income tax estimate (New Regime)</h3><div class=\"ca-g\">" + kpi("FY profit (ab tak)", rs(ytd), gl(ytd)) + kpi("Full-year projection", rs(proj)) +
      kpi("Estimated tax", rs(tax), tax > 0 ? "loss" : "gain") + kpi("Monthly set-aside", rs(tax / 12)) + "</div>";
    h += '<div class="note">Slabs: 0-4L nil, 4-8L 5%, 8-12L 10%, 12-16L 15%, 16-20L 20%, 20-24L 25%, 24L+ 30%. Taxable income Rs 12 lakh tak rebate (87A) se tax zero. 4% cess upar se. Projection = ab tak ka profit / months x 12. ITR phir bhi file karo (loan, visa, proof of income ke kaam aata hai). Yeh estimate hai, professional tax advice nahi: filing se pehle incometax.gov.in pe verify karo ya CA se check karwa lo.</div>';
    return h;
  }

  function viewLearn() {
    return '<h3 style="margin-top:0">Basics, 2 minute me</h3><div class="note" style="font-size:14px;line-height:1.6">' +
      "<b>ROI</b> = (Kamaya - Lagaya) / Lagaya. Rs 1000 ads se Rs 3000 aaya to ROI 200%.<br><br>" +
      "<b>P&amp;L (Profit and Loss)</b> = Income - Expenses. Yeh batata hai is period me kamaya ya gawaya.<br><br>" +
      "<b>Balance sheet</b> = Assets - Liabilities = Equity. Yeh batata hai tum kitne ameer ho, P&amp;L batata hai kitna kama rahe ho.<br><br>" +
      "<b>Gross margin</b> = (Revenue - direct cost) / Revenue. Service me 70%+ hona chahiye.<br><br>" +
      "<b>CAC</b> = ek customer lane me kitna kharcha. <b>LTV</b> = ek customer poori life me kitna dega. LTV, CAC se kam hua to business ghata hai.<br><br>" +
      "<b>GST</b>: services ka turnover Rs 20 lakh/saal cross kare tab registration lazmi (kuch cases me pehle, jaise inter-state).<br><br>" +
      "<b>Rule</b>: har entry ka bill/screenshot save rakho. Tax time pe yahi kaam aata hai.</div>";
  }

  // ---------- render + events ----------
  var SUBS = [["pl", "P&amp;L + ROI"], ["sip", "SIP"], ["bs", "Balance + Tax"], ["learn", "Seekho"]];
  function render() {
    if (!root || !ctx) return;
    var h = '<div class="toolbar">' + SUBS.map(function (s) {
      return '<button class="btn' + (s[0] === sub ? " primary" : "") + '" data-ca-sub="' + s[0] + '">' + s[1] + "</button>";
    }).join("") + "</div>";
    h += sub === "sip" ? viewSIP() : sub === "bs" ? viewBS() : sub === "learn" ? viewLearn() : viewPL();
    root.innerHTML = h;
  }
  function val(id) { var el = root.querySelector("#" + id); return el ? el.value : ""; }
  function commit(refreshAll) { ctx.save(); if (refreshAll && ctx.refresh) ctx.refresh(); else render(); }

  function bind() {
    root.addEventListener("click", function (e) {
      var s = e.target.closest("[data-ca-sub]");
      if (s) { sub = s.getAttribute("data-ca-sub"); render(); return; }
      var b = e.target.closest("[data-ca]");
      if (!b) return;
      var a = b.getAttribute("data-ca"), c = C();
      if (a === "addfin") {
        var amt = n(val("ca-fa"));
        if (amt <= 0) { root.querySelector("#ca-fa").focus(); return; }
        var rec = { id: ctx.uid(), type: val("ca-ft"), date: val("ca-fd") || today(), amount: amt, source: val("ca-fs").trim() || "Other" };
        if (ctx.addFinance) ctx.addFinance(rec); else S().finance.push(rec);
        commit(true);
      } else if (a === "addw") {
        var wa = n(val("ca-wa"));
        if (wa <= 0) { root.querySelector("#ca-wa").focus(); return; }
        c.sp.w.push({ d: val("ca-wd") || today(), f: val("ca-wf"), a: wa, n: val("ca-wn") });
        commit(false);
      } else if (a === "delw") {
        c.sp.w.splice(+b.getAttribute("data-i"), 1);
        commit(false);
      }
    });
    // settings save on change (not on every keypress, so typing is not interrupted)
    root.addEventListener("change", function (e) {
      var id = e.target.id, c = C(), v = e.target.value;
      var map = {
        "ca-tg": function () { c.tg = n(v) || 200; },
        "ca-ss": function () { c.sp.s = v; },
        "ca-sg": function () { c.sp.g = v === "" ? 100 : n(v); },
        "ca-sb": function () { c.sp.b = v === "" ? 100 : n(v); },
        "ca-sm": function () { c.sp.m = Math.max(0, Math.round(n(v))); },
        "ca-oc": function () { c.oc = n(v); },
        "ca-li": function () { c.li = n(v); },
        "ca-as": function () { c.as = n(v); }
      };
      if (map[id]) { map[id](); commit(false); }
    });
  }

  // called by index.html when the CA tab opens or data reloads
  window.caTabOpen = function (context) {
    ctx = context;
    if (!root) { root = document.getElementById("tab-ca"); if (!root) return; bind(); }
    C();
    render();
  };
})();
