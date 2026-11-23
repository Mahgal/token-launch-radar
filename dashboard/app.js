// Token Launch Radar's dashboard. It reads window.RADAR (written beside
// dashboard/ by main.ts) and renders the ranked board, a filterable table, a
// per-protocol detail view with the model's own arithmetic and the protocol's
// farm plan, the live-token view and the model page. No network: every byte
// it shows is in data.js. No links out: the page names slugs, it never
// points at them.
(function () {
  'use strict';
  var DATA = window.RADAR;
  var main = document.getElementById('board');
  if (!DATA || !main) return;

  var state = { view: 'board', q: '', category: 'all', chain: 'all', sort: 'implied', watchlist: false, selected: null };
  var watchSet = {};
  (DATA.watchlist || []).forEach(function (s) { watchSet[s] = true; });
  var bySlug = {};
  DATA.rows.forEach(function (r) { bySlug[r.slug] = r; });
  var maxImplied = DATA.rows.length ? DATA.rows[0].implied_value_usd : 1;

  // ---------- formatting ----------
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtFull(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- the model, in the page ----------
  // The page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are
  // visibly the same arithmetic. The multiple is the row's own comparables
  // multiple, priced from live tokens in its category (or the global median
  // where its category has fewer than 3 live tokens).
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    return Math.max(1, Math.round(row.tvl_usd * row.comp_multiple * growthMult * maturity));
  }

  // ---------- dom helpers ----------
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }
  function setHash() {
    var p = new URLSearchParams();
    if (state.view !== 'board') p.set('view', state.view);
    if (state.selected) p.set('detail', state.selected);
    if (state.q) p.set('q', state.q);
    if (state.category !== 'all') p.set('cat', state.category);
    if (state.chain !== 'all') p.set('chain', state.chain);
    if (state.sort !== 'implied') p.set('sort', state.sort);
    if (state.watchlist) p.set('watchlist', '1');
    var h = p.toString();
    var next = h ? '#' + h : '#';
    if (window.location.hash !== next) history.replaceState(null, '', next);
  }
  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var p = new URLSearchParams(hash);
    state.view = p.get('view') || 'board';
    state.selected = p.get('detail') || null;
    state.q = p.get('q') || '';
    state.category = p.get('cat') || 'all';
    state.chain = p.get('chain') || 'all';
    state.sort = p.get('sort') || 'implied';
    state.watchlist = p.get('watchlist') === '1';
    if (state.view !== 'board') state.selected = state.view === 'board' ? state.selected : state.selected;
  }

  // ---------- header stats ----------
  function renderStats() {
    var box = document.getElementById('stats');
    box.innerHTML = '';
    var top = DATA.rows[0];
    var watchValue = DATA.rows.filter(function (r) { return watchSet[r.slug]; })
      .reduce(function (n, r) { return n + r.implied_value_usd; }, 0);
    var items = [
      [String(DATA.board_size), 'ranked rows'],
      [String(DATA.watchlist_size), 'on the watchlist'],
      [String(DATA.pre_token_size), 'pre-token in the snapshot'],
      [fmtUsd(watchValue), 'watchlist implied value'],
      [top ? top.name + ' #' + top.rank : '—', 'top of the board'],
    ];
    items.forEach(function (it) {
      box.appendChild(el('div', { class: 'stat' }, el('b', { text: it[0] }), el('span', { text: it[1] })));
    });
  }

  // ---------- filters ----------
  function fillSelects() {
    var catSel = document.getElementById('cat');
    var chainSel = document.getElementById('chain');
    var cats = {};
    var chains = {};
    DATA.rows.forEach(function (r) {
      if (r.category) cats[r.category] = true;
      (r.chains || []).forEach(function (c) { chains[c] = true; });
    });
    Object.keys(cats).sort().forEach(function (c) {
      catSel.appendChild(el('option', { value: c, text: c + ' (' + DATA.rows.filter(function (r) { return r.category === c; }).length + ')' }));
    });
    Object.keys(chains).sort().forEach(function (c) {
      chainSel.appendChild(el('option', { value: c, text: c }));
    });
    catSel.value = state.category;
    chainSel.value = state.chain;
    document.getElementById('q').value = state.q;
    document.getElementById('sort').value = state.sort;
    document.getElementById('watchlist').checked = state.watchlist;
  }
  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (state.watchlist && !watchSet[r.slug]) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort;
    rows = rows.slice().sort(function (a, b) {
      if (key === 'tvl') return b.tvl_usd - a.tvl_usd;
      if (key === 'growth') return (b.change_7d === null ? -1e9 : b.change_7d) - (a.change_7d === null ? -1e9 : a.change_7d);
      if (key === 'age') return (b.age_days === null ? -1 : b.age_days) - (a.age_days === null ? -1 : a.age_days);
      return a.rank - b.rank;
    });
    return rows;
  }

  // ---------- board ----------
  function renderBoard() {
    main.innerHTML = '';
    main.setAttribute('aria-busy', 'false');
    var rows = filteredRows();
    var count = el('p', { class: 'count', text: rows.length + ' of ' + DATA.rows.length + ' ranked rows' +
      (state.watchlist ? ' · watchlist only' : '') +
      (state.category !== 'all' ? ' · ' + state.category : '') +
      (state.chain !== 'all' ? ' · ' + state.chain : '') +
      (state.q ? ' · matching "' + state.q + '"' : '') + ' · snapshot as of ' + DATA.as_of });
    main.appendChild(count);
    if (rows.length === 0) {
      main.appendChild(el('div', { class: 'empty', text: 'No protocol matches this filter. Clear the search or pick another category.' }));
      return;
    }
    var table = el('table', {});
    var thead = el('thead', {}, el('tr', {},
      el('th', { text: '#' }), el('th', { text: 'Protocol' }), el('th', { text: 'Category' }),
      el('th', { text: 'Chains' }), el('th', { class: 'num', text: 'TVL' }),
      el('th', { class: 'num', text: '7d' }), el('th', { class: 'num', text: 'Age' }),
      el('th', { class: 'num', text: 'Implied value' }), el('th', { class: 'num', text: 'Farm' })));
    table.appendChild(thead);
    var tbody = el('tbody', {});
    rows.forEach(function (r) {
      var pct = r.change_7d;
      var pctCell = el('td', { class: 'num ' + (pct === null ? 'mut' : pct >= 0 ? 'pos' : 'neg'), text: fmtPct(pct) });
      var valCell = el('td', { class: 'num' },
        el('span', { class: 'val', text: fmtUsd(r.implied_value_usd) }),
        el('div', { class: 'bar' }, el('i', { style: 'width:' + Math.max(2, Math.round(100 * r.implied_value_usd / maxImplied)) + '%' })));
      var nameCell = el('td', {},
        el('span', { class: 'name', text: r.name }),
        watchSet[r.slug] ? el('span', { class: 'badge', text: 'WATCHLIST' }) : null,
        el('div', { class: 'slug', text: r.slug }));
      var tr = el('tr', { onclick: function () { openDetail(r.slug); } },
        el('td', { class: 'rank', text: String(r.rank) }),
        nameCell,
        el('td', {}, el('span', { class: 'chip', text: r.category || '—' })),
        el('td', { class: 'mut', text: (r.chains || []).slice(0, 2).join(', ') || '—' }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        pctCell,
        el('td', { class: 'num mut', text: fmtAge(r.age_days) }),
        valCell,
        el('td', { class: 'num mut', text: '$' + r.capital_usd + ' · ' + r.hold_days + 'd' }));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    main.appendChild(table);
  }

  // ---------- detail ----------
  function openDetail(slug) {
    state.selected = slug;
    state.view = 'board';
    setHash();
    render();
    main.focus();
  }
  function renderDetail() {
    var r = bySlug[state.selected];
    main.innerHTML = '';
    if (!r) {
      main.appendChild(el('div', { class: 'empty', text: 'No protocol with that slug on this board.' }));
      return;
    }
    var recomputed = impliedOf(r, DATA.model);
    var match = recomputed === r.implied_value_usd;
    var wrap = el('div', { class: 'detail' });
    wrap.appendChild(el('button', { class: 'back', type: 'button', text: '← Back to the board', onclick: function () { state.selected = null; setHash(); render(); } }));
    var head = el('div', {},
      el('h2', { text: '#' + r.rank + '  ' + r.name }),
      el('p', { class: 'sub', text: r.slug + ' · ' + (r.category || 'Uncategorised') + ' · ' + (r.chains || []).join(', ') +
        ' · tracked since ' + (r.listed_at || 'unknown') + ' (' + fmtAge(r.age_days) + ' with no token)' }));
    wrap.appendChild(head);
    var pills = el('p', {},
      el('span', { class: 'pill watch', text: watchSet[r.slug] ? 'ON THE WATCHLIST' : 'EARLY — BELOW THE WATCHLIST FLOOR' }),
      el('span', { text: '  ' }),
      el('span', { class: 'pill live', text: 'PRE-TOKEN — RECORDS NO TOKEN' }));
    wrap.appendChild(pills);
    var grid = el('div', { class: 'grid' });
    var left = el('div', { class: 'card' },
      el('h3', { text: 'Implied launch value — the working' }),
      el('div', { class: 'kv' }, el('span', { text: 'TVL' }), el('b', { text: fmtFull(r.tvl_usd) })),
      el('div', { class: 'kv' }, el('span', { text: 'Category comps multiple' }),
        el('b', { text: '×' + r.comp_multiple.toFixed(4) + '  (' + (r.comp_source === 'category' ? r.category + ' median, ' + r.comp_n + ' live tokens' : 'global median — too few live tokens in this category') + ')' })),
      el('div', { class: 'kv' }, el('span', { text: '7-day TVL change' }), el('b', { text: fmtPct(r.change_7d) + '  →  growth ×' + r.growth_multiplier.toFixed(4) })),
      el('div', { class: 'kv' }, el('span', { text: 'Age with no token' }), el('b', { text: fmtAge(r.age_days) + '  →  maturity ×' + r.maturity_multiplier.toFixed(4) })),
      el('div', { class: 'kv' }, el('span', { text: 'Implied value' }), el('b', { class: 'big', text: fmtFull(r.implied_value_usd) })),
      el('div', { class: 'math', text: fmtFull(r.tvl_usd) + ' × ' + r.comp_multiple.toFixed(4) + ' × ' + r.growth_multiplier.toFixed(4) + ' × ' + r.maturity_multiplier.toFixed(4) + ' = ' + fmtFull(r.implied_value_usd) }),
      el('p', { class: 'note', text: 'Page recomputation from the same figures: ' + fmtFull(recomputed) + (match ? ' — matches board.json.' : ' — DIFFERS from board.json by ' + fmtFull(recomputed - r.implied_value_usd) + '.') }));
    var comp = null;
    (DATA.comps || []).forEach(function (c) { if (c.category === r.category) comp = c; });
    var right = el('div', { class: 'card' }, el('h3', { text: 'Comparables — what the multiple is' }));
    if (comp) {
      right.appendChild(el('div', { class: 'kv' }, el('span', { text: 'Category median mcap / TVL' }), el('b', { text: '×' + comp.multiple.toFixed(4) + ' over ' + comp.n + ' live tokens' })));
      comp.top.forEach(function (t) {
        right.appendChild(el('div', { class: 'kv' }, el('span', { text: t.name }), el('b', { text: fmtUsd(t.mcap_usd) + ' mcap · ×' + t.multiple.toFixed(3) })));
      });
    } else {
      right.appendChild(el('p', { class: 'note', text: 'This category has fewer than 3 live tokens in the snapshot, so the model prices it at the global median multiple ×' + DATA.global_multiple.toFixed(4) + ' instead.' }));
    }
    right.appendChild(el('p', { class: 'note', text: 'A multiple is a market fact, not a guess: the median of what tokens in the same line of business already trade at per dollar of TVL.' }));
    grid.appendChild(left);
    grid.appendChild(right);
    wrap.appendChild(grid);
    var plan = el('div', { class: 'card', }, el('h3', { text: 'Farm plan — ' + r.name }));
    var ol = el('ol', { class: 'steps' });
    (r.farm_steps || []).forEach(function (s) { ol.appendChild(el('li', { text: s })); });
    plan.appendChild(ol);
    plan.appendChild(el('p', { class: 'note', text: 'Budget: about $' + r.capital_usd + ' of capital, plus roughly $15–25 of gas over ' + r.hold_days + ' days. Never pay to claim: a real airdrop never asks for a fee to collect it.' }));
    wrap.appendChild(plan);
    main.appendChild(wrap);
  }

  // ---------- market strip: the whole market at a glance ----------
  function renderMarket() {
    var box = document.getElementById('market');
    box.innerHTML = '';
    var rows = DATA.rows;
    var totalImplied = rows.reduce(function (n, r) { return n + r.implied_value_usd; }, 0);
    var totalTvl = rows.reduce(function (n, r) { return n + r.tvl_usd; }, 0);
    var changes = rows.map(function (r) { return r.change_7d; })
      .filter(function (c) { return c !== null && c !== undefined; })
      .sort(function (a, b) { return a - b; });
    var median = changes.length ? changes[Math.floor(changes.length / 2)] : null;
    var up = rows.filter(function (r) { return r.change_7d !== null && r.change_7d > 0; }).length;
    var down = rows.filter(function (r) { return r.change_7d !== null && r.change_7d < 0; }).length;
    var flat = rows.length - up - down;
    var gainer = rows.slice().sort(function (a, b) {
      return (b.change_7d === null ? -1e9 : b.change_7d) - (a.change_7d === null ? -1e9 : a.change_7d);
    })[0];
    function tile(label, big, sub, cls) {
      var t = el('div', { class: 'mkt' },
        el('span', { class: 'lbl', text: label }),
        el('span', { class: 'big' + (cls ? ' ' + cls : ''), text: big }),
        sub ? el('span', { class: 'sub2', text: sub }) : null);
      box.appendChild(t);
      return t;
    }
    tile('Total implied value', fmtUsd(totalImplied), 'all ' + rows.length + ' ranked rows');
    tile('Ranked TVL', fmtUsd(totalTvl), 'TVL with no token behind it');
    tile('Median 7d', fmtPct(median), 'across the ranked board', median !== null && median >= 0 ? 'up' : 'down');
    var breadth = tile('Breadth · 7d', up + ' up / ' + down + ' down', flat + ' flat or no data');
    breadth.appendChild(el('div', { class: 'bread' },
      el('i', { class: 'g', style: 'width:' + (100 * up / rows.length) + '%' }),
      el('i', { class: 'r', style: 'width:' + (100 * down / rows.length) + '%' })));
    box.appendChild(el('button', { class: 'mkt', type: 'button', onclick: function () { openDetail(gainer.slug); } },
      el('span', { class: 'lbl', text: 'Top gainer · 7d' }),
      el('span', { class: 'big up', text: gainer.name }),
      el('span', { class: 'sub2', text: fmtPct(gainer.change_7d) + ' · TVL ' + fmtUsd(gainer.tvl_usd) + ' — open' })));
  }

  // ---------- movers ----------
  function moverTable(rows, last) {
    var table = el('table', { class: 'mini' });
    table.appendChild(el('thead', {}, el('tr', {},
      el('th', { text: '#' }), el('th', { text: 'Protocol' }), el('th', { class: 'num', text: 'TVL' }),
      el('th', { class: 'num', text: '7d' }), el('th', { class: 'num', text: last === 'swing' ? '$ swing' : 'Implied' }))));
    var tbody = el('tbody', {});
    rows.forEach(function (r) {
      var swing = r.tvl_usd * (r.change_7d === null ? 0 : r.change_7d) / 100;
      tbody.appendChild(el('tr', { onclick: function () { openDetail(r.slug); } },
        el('td', { class: 'rank', text: String(r.rank) }),
        el('td', {}, el('span', { class: 'name', text: r.name }),
          watchSet[r.slug] ? el('span', { class: 'badge', text: 'WATCHLIST' }) : null),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num pct ' + (r.change_7d === null ? 'mut' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num ' + (last === 'swing' ? (swing >= 0 ? 'pos' : 'neg') : 'val'),
          text: last === 'swing' ? (swing >= 0 ? '+' : '−') + fmtUsd(Math.abs(swing)) : fmtUsd(r.implied_value_usd) })));
    });
    table.appendChild(tbody);
    return table;
  }
  function renderMovers() {
    main.innerHTML = '';
    main.appendChild(el('div', { class: 'sect' },
      el('h2', { text: 'Movers — 7-day TVL change' }),
      el('p', { text: 'The snapshot\u2019s own figures, across the ' + DATA.rows.length + ' ranked rows. A move is what the market did; the model prices growth clamped to +120%, so a +4,448% week still scores as +120%. Click a row to open its detail.' })));
    var withChange = DATA.rows.filter(function (r) { return r.change_7d !== null && r.change_7d !== undefined; });
    var byChange = withChange.slice().sort(function (a, b) { return b.change_7d - a.change_7d; });
    var byDollar = DATA.rows.slice()
      .map(function (r) { return { r: r, d: Math.abs(r.tvl_usd * (r.change_7d === null ? 0 : r.change_7d) / 100) }; })
      .sort(function (a, b) { return b.d - a.d; }).slice(0, 8)
      .map(function (x) { return x.r; });
    var grid = el('div', { class: 'movers' });
    var gainers = el('div', { class: 'card' }, el('h3', { text: 'Top gainers · 7d' }));
    gainers.appendChild(moverTable(byChange.slice(0, 10), 'implied'));
    var losers = el('div', { class: 'card' }, el('h3', { text: 'Top losers · 7d' }));
    losers.appendChild(moverTable(byChange.slice(-10).reverse(), 'implied'));
    var swings = el('div', { class: 'card full' }, el('h3', { text: 'Biggest dollar swings — TVL gained or lost in the week' }));
    swings.appendChild(moverTable(byDollar, 'swing'));
    grid.appendChild(gainers);
    grid.appendChild(losers);
    grid.appendChild(swings);
    main.appendChild(grid);
  }

  // ---------- new listings ----------
  function renderNew() {
    main.innerHTML = '';
    main.appendChild(el('div', { class: 'sect' },
      el('h2', { text: 'New — the most recently tracked launches' }),
      el('p', { text: '\u201CNew\u201D means newly tracked by DefiLlama, not newly launched — a protocol can run for years before it appears here. Click a row to open its detail.' })));
    var rows = DATA.rows.filter(function (r) { return r.listed_at; })
      .sort(function (a, b) { return b.listed_at.localeCompare(a.listed_at); }).slice(0, 20);
    var nodate = DATA.rows.filter(function (r) { return !r.listed_at; }).length;
    var table = el('table', {});
    table.appendChild(el('thead', {}, el('tr', {},
      el('th', { text: 'Listed' }), el('th', { text: 'Protocol' }), el('th', { text: 'Category' }),
      el('th', { class: 'num', text: 'TVL' }), el('th', { class: 'num', text: 'Age' }),
      el('th', { class: 'num', text: 'Implied value' }))));
    var tbody = el('tbody', {});
    rows.forEach(function (r) {
      tbody.appendChild(el('tr', { onclick: function () { openDetail(r.slug); } },
        el('td', { class: 'mut', text: r.listed_at }),
        el('td', {}, el('span', { class: 'name', text: r.name }),
          watchSet[r.slug] ? el('span', { class: 'badge', text: 'WATCHLIST' }) : null,
          el('div', { class: 'slug', text: r.slug })),
        el('td', {}, el('span', { class: 'chip', text: r.category || '—' })),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num mut', text: fmtAge(r.age_days) }),
        el('td', { class: 'num val', text: fmtUsd(r.implied_value_usd) })));
    });
    table.appendChild(tbody);
    main.appendChild(table);
    main.appendChild(el('p', { class: 'count', text: 'Showing the 20 most recently tracked of ' + DATA.rows.length + ' ranked rows · ' + nodate + ' rows carry no listing date.' }));
  }

  // ---------- live ----------
  function renderLive() {
    main.innerHTML = '';
    main.appendChild(el('p', { class: 'count', text: 'Tokens that already trade, by market cap — the market\u2019s own values, not a model\u2019s. The board ranks only what has not launched yet.' }));
    var table = el('table', {});
    table.appendChild(el('thead', {}, el('tr', {},
      el('th', { text: '#' }), el('th', { text: 'Protocol' }), el('th', { text: 'Category' }),
      el('th', { class: 'num', text: 'TVL' }), el('th', { class: 'num', text: 'Market cap' }),
      el('th', { class: 'num', text: 'mcap / TVL' }), el('th', { class: 'num', text: '7d' }))));
    var tbody = el('tbody', {});
    DATA.live.forEach(function (p, i) {
      var mult = p.tvl_usd > 0 && p.mcap_usd !== null ? p.mcap_usd / p.tvl_usd : null;
      tbody.appendChild(el('tr', { onclick: function () {} },
        el('td', { class: 'rank', text: String(i + 1) }),
        el('td', {}, el('span', { class: 'name', text: p.name }), el('div', { class: 'slug', text: p.slug })),
        el('td', {}, el('span', { class: 'chip', text: p.category || '—' })),
        el('td', { class: 'num', text: fmtUsd(p.tvl_usd) }),
        el('td', { class: 'num val', text: fmtUsd(p.mcap_usd) }),
        el('td', { class: 'num', text: mult === null ? 'n/a' : '×' + mult.toFixed(3) }),
        el('td', { class: 'num ' + (p.change_7d === null ? 'mut' : p.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(p.change_7d) })));
    });
    table.appendChild(tbody);
    main.appendChild(table);
  }

  // ---------- model ----------
  function renderModel() {
    main.innerHTML = '';
    var m = DATA.model;
    var wrap = el('div', { class: 'detail' });
    wrap.appendChild(el('h2', { text: 'The model — radar-2' }));
    wrap.appendChild(el('p', { class: 'sub', text: 'A launch is priced the way a market prices one: what comparable tokens already trade at per dollar of TVL, in the same line of business — then moved by the protocol\u2019s own growth and by how long it has run with no token.' }));
    wrap.appendChild(el('div', { class: 'math', text: 'implied = TVL × comp_multiple × growth_mult × maturity_mult' }));
    var grid = el('div', { class: 'grid' });
    var c1 = el('div', { class: 'card' }, el('h3', { text: 'The three factors' }),
      el('div', { class: 'kv' }, el('span', { text: 'Comps multiple' }), el('b', { text: 'category median mcap / TVL (≥3 live tokens), else global ×' + DATA.global_multiple.toFixed(4) + '; clamped ×0.05–×1.50' })),
      el('div', { class: 'kv' }, el('span', { text: 'Growth' }), el('b', { text: '1 + clamp(7d change, ' + m.growth_floor + '%, ' + m.growth_cap + '%) × ' + m.growth_weight })),
      el('div', { class: 'kv' }, el('span', { text: 'Maturity' }), el('b', { text: m.maturity_floor + ' + ' + m.maturity_range + ' × min(age, ' + m.maturity_days + 'd) / ' + m.maturity_days + 'd' })),
      el('div', { class: 'kv' }, el('span', { text: 'Age unknown' }), el('b', { text: m.unknown_age_days + ' days assumed' })),
      el('p', { class: 'note', text: 'No protocol name is ever special-cased. The same function scores every row; change a constant and the whole board reprices.' }));
    var c2 = el('div', { class: 'card' }, el('h3', { text: 'What the board leaves out — and why' }),
      el('p', { class: 'note', text: 'The board ranks farmable launches only. Out: exchanges (CEX), bridges, staking receipts and versioned pools — the same exclusions the snapshot\u2019s watchlist rule uses — because none of them is a launch a reader can farm. The 40 watchlist slugs are all in, by construction. Live-token protocols are not ranked; they are the comparables, shown on the Live tokens tab.' }),
      el('p', { class: 'note', text: 'Implied value is a claim about what a launch would be worth if the protocol\u2019s record stayed as it is. It does not predict whether or when a token is issued.' }));
    grid.appendChild(c1);
    grid.appendChild(c2);
    wrap.appendChild(grid);
    var card = el('div', { class: 'card' }, el('h3', { text: 'Comparables by category — median mcap / TVL of live tokens' }));
    var table = el('table', {});
    table.appendChild(el('thead', {}, el('tr', {},
      el('th', { text: 'Category' }), el('th', { class: 'num', text: 'Multiple' }),
      el('th', { class: 'num', text: 'Live tokens' }), el('th', { text: 'Largest comps' }))));
    var tbody = el('tbody', {});
    (DATA.comps || []).forEach(function (c) {
      tbody.appendChild(el('tr', { onclick: function () {} },
        el('td', { text: c.category }),
        el('td', { class: 'num val', text: '×' + c.multiple.toFixed(4) }),
        el('td', { class: 'num', text: String(c.n) }),
        el('td', { class: 'mut', text: (c.top || []).map(function (t) { return t.name + ' ×' + t.multiple.toFixed(2); }).join(', ') || '—' })));
    });
    table.appendChild(tbody);
    card.appendChild(table);
    wrap.appendChild(card);
    main.appendChild(wrap);
  }

  // ---------- render ----------
  function render() {
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === state.view);
    });
    document.getElementById('controls').style.display = state.view === 'board' && !state.selected ? '' : 'none';
    if (state.view === 'live') renderLive();
    else if (state.view === 'model') renderModel();
    else if (state.view === 'movers') renderMovers();
    else if (state.view === 'new') renderNew();
    else if (state.selected) renderDetail();
    else renderBoard();
  }
  function bind() {
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.view = b.getAttribute('data-view');
        state.selected = null;
        setHash();
        render();
      });
    });
    document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; setHash(); renderBoard(); });
    document.getElementById('cat').addEventListener('change', function (e) { state.category = e.target.value; setHash(); renderBoard(); });
    document.getElementById('chain').addEventListener('change', function (e) { state.chain = e.target.value; setHash(); renderBoard(); });
    document.getElementById('sort').addEventListener('change', function (e) { state.sort = e.target.value; setHash(); renderBoard(); });
    document.getElementById('watchlist').addEventListener('change', function (e) { state.watchlist = e.target.checked; setHash(); renderBoard(); });
    window.addEventListener('hashchange', function () { readHash(); syncControls(); render(); });
  }
  function syncControls() {
    document.getElementById('q').value = state.q;
    document.getElementById('cat').value = state.category;
    document.getElementById('chain').value = state.chain;
    document.getElementById('sort').value = state.sort;
    document.getElementById('watchlist').checked = state.watchlist;
  }

  readHash();
  renderStats();
  renderMarket();
  fillSelects();
  bind();
  render();
})();
