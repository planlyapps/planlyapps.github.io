/* Planly planner engine. Local-first: everything a buyer types stays in their own browser storage. */
(function () {
  'use strict';
  const P = (window.Planly = { ui: {}, actions: {} });
  const DAY = 864e5;

  // ---------- helpers
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const parseDate = (s) => {
    if (!s || typeof s !== 'string') return null;
    const [y, m, d] = s.split('-').map(Number);
    return y && m && d ? new Date(y, m - 1, d) : null;
  };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const daysUntil = (s) => { const d = parseDate(s); return d ? Math.round((d - today()) / DAY) : null; };
  const fmtDate = (s, o) => {
    const d = typeof s === 'string' ? parseDate(s) : s;
    return d ? d.toLocaleDateString(undefined, o || { day: 'numeric', month: 'short' }) : '';
  };
  const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  Object.assign(P, { esc, uid, today, parseDate, iso, daysUntil, fmtDate, num, cap, plural, DAY });

  let currency = 'GBP';
  P.money = (n) => {
    n = num(n);
    const whole = Math.round(n) === n;
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(n);
    } catch (e) { return n.toFixed(whole ? 0 : 2); }
  };
  P.guessCurrency = () => {
    const l = (navigator.language || 'en-GB').toLowerCase();
    if (l.endsWith('-us')) return 'USD';
    if (l.endsWith('-ca')) return 'CAD';
    if (l.endsWith('-au')) return 'AUD';
    if (l.endsWith('-nz')) return 'NZD';
    if (/^(de|fr|es|it|nl|pt|fi|el|sk|sl|et|lv|lt)|-ie$/.test(l)) return 'EUR';
    return l.startsWith('en-gb') ? 'GBP' : 'USD';
  };
  P.CURRENCIES = [['GBP', 'Pound (£)'], ['USD', 'US dollar ($)'], ['EUR', 'Euro (€)'], ['CAD', 'Canadian dollar ($)'], ['AUD', 'Australian dollar ($)'], ['NZD', 'New Zealand dollar ($)']];

  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
    more: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h3M11 17h9"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
  };
  P.icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" class="ic">${ICONS[name] || P.cfg.icons?.[name] || ''}</svg>`;
  P.bar = (value, max, label) => {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return `<div class="bar${max > 0 && value > max ? ' over' : ''}" role="img" aria-label="${esc(label || '')}"><i style="width:${pct.toFixed(1)}%"></i></div>`;
  };

  // ---------- storage
  const strip = (v) => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v)) if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype') o[k] = strip(v[k]);
      return o;
    }
    return v;
  };
  function createStore(key, defaults) {
    const fill = (d) => {
      const base = defaults();
      if (!d || typeof d !== 'object' || Array.isArray(d)) return base;
      for (const k in base) {
        if (!(k in d) || typeof d[k] !== typeof base[k] || Array.isArray(base[k]) !== Array.isArray(d[k])) d[k] = base[k];
      }
      for (const k in base) if (Array.isArray(d[k])) d[k] = d[k].filter((x) => x && typeof x === 'object' && typeof x.id === 'string' && /^[\w-]{1,40}$/.test(x.id));
      return d;
    };
    let data;
    try { data = fill(strip(JSON.parse(localStorage.getItem(key)))); } catch (e) { data = fill(null); }
    const listeners = [];
    return {
      get data() { return data; },
      save() {
        try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { P.toast('Could not save. Your browser storage may be full.'); }
        listeners.forEach((f) => f());
      },
      replace(next) { data = fill(strip(next)); this.save(); },
      reset() { data = fill(null); this.save(); },
      on(f) { listeners.push(f); },
    };
  }

  // ---------- shell and routing
  let cfg, store, view, sheet, toastEl, toastTimer;
  const S = () => store.data.settings;

  P.start = function (config) {
    cfg = P.cfg = config;
    store = P.store = createStore(cfg.storageKey, cfg.defaults);
    currency = S().currency || P.guessCurrency();
    store.on(() => { currency = S().currency || currency; render(); });

    const tabs = cfg.sections.filter((s) => s.tab);
    const link = (s) => `<a href="#${s.id}" data-nav="${s.id}">${P.icon(s.icon)}<span>${esc(s.label)}</span></a>`;
    document.body.insertAdjacentHTML('afterbegin', `
      <a class="skip" href="#view">Skip to content</a>
      <div class="shell">
        <nav class="side" aria-label="Sections"><p class="brand">${esc(cfg.name)}</p>${cfg.sections.map(link).join('')}</nav>
        <main id="view" tabindex="-1"></main>
        <nav class="tabs" aria-label="Sections">${tabs.map(link).join('')}${link({ id: 'more', label: 'More', icon: 'more' })}</nav>
      </div>
      <dialog id="sheet" aria-labelledby="sheet-title"></dialog>
      <div id="toast" role="status" aria-live="polite"></div>`);
    view = document.getElementById('view');
    sheet = document.getElementById('sheet');
    toastEl = document.getElementById('toast');

    window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('input', onInput);
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); P.installEvent = e; });

    render();
    if (!S().onboarded) P.openSetup(true);
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  };

  const moreSection = {
    id: 'more', label: 'More', icon: 'more',
    view: () => `<header class="vh"><h1>More</h1></header>
      <ul class="rows">${cfg.sections.filter((s) => !s.tab).map((s) => `
        <li class="row"><a class="row-main row-link" href="#${s.id}">${P.icon(s.icon)}<span><span class="row-t">${esc(s.label)}</span>${s.hint ? `<span class="row-s">${esc(s.hint)}</span>` : ''}</span></a>${P.icon('chevron')}</li>`).join('')}
      </ul>`,
  };
  function current() {
    const id = location.hash.slice(1) || cfg.sections[0].id;
    return cfg.sections.find((s) => s.id === id) || (id === 'more' ? moreSection : cfg.sections[0]);
  }
  function render() {
    const sec = current();
    view.innerHTML = sec.view(P);
    const moreActive = !cfg.sections.find((s) => s.id === sec.id)?.tab;
    document.querySelectorAll('[data-nav]').forEach((a) => {
      const on = a.dataset.nav === sec.id || (a.closest('.tabs') && a.dataset.nav === 'more' && moreActive);
      on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
    });
    document.title = sec.id === cfg.sections[0].id ? cfg.name : `${sec.label} | ${cfg.name}`;
  }
  P.render = () => render();

  function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const [act, a, b, c] = el.dataset.act.split(':');
    if (act === 'add') P.edit(a);
    else if (act === 'edit') P.edit(a, b);
    else if (act === 'toggle') {
      const it = store.data[a].find((x) => x.id === b);
      if (it) { it[c] = !it[c]; store.save(); }
    } else if (act === 'filter') { P.ui[a].filter = b; render(); }
    else if (P.actions[act]) P.actions[act](el, a, b, c);
  }
  function onChange(e) {
    const el = e.target.closest('[data-change]');
    if (!el) return;
    const [act, a, b, c] = el.dataset.change.split(':');
    if (act === 'set') {
      const it = store.data[a].find((x) => x.id === b);
      if (it) { it[c] = el.value; store.save(); }
    } else if (P.actions[act]) P.actions[act](el, a, b, c);
  }
  function onInput(e) {
    const el = e.target.closest('[data-search]');
    if (!el) return;
    const key = el.dataset.search;
    P.ui[key].q = el.value;
    const body = view.querySelector(`[data-list="${key}"]`);
    if (body) body.innerHTML = listBody(key);
  }

  // ---------- generic list views
  P.listView = function (key, o = {}) {
    const c = cfg.collections[key];
    const ui = (P.ui[key] ||= { filter: 'all', q: '' });
    const items = store.data[key];
    let html = `<header class="vh"><h1>${esc(o.title || c.label)}</h1>
      <button class="btn" data-act="add:${key}" aria-label="Add ${esc(c.singular)}">${P.icon('plus')}<span>Add</span></button></header>`;
    if (o.top) html += o.top(items);
    if (c.filter && items.length) {
      const f = c.filter;
      const w = f.weight || (() => 1);
      const count = (v) => items.filter((it) => v === 'all' || f.get(it) === v).reduce((t, it) => t + w(it), 0);
      html += `<div class="chips" role="group" aria-label="Filter ${esc(c.label.toLowerCase())}">
        <button class="chip" aria-pressed="${ui.filter === 'all'}" data-act="filter:${key}:all">All<b>${count('all')}</b></button>
        ${f.options.map(([v, l]) => `<button class="chip" aria-pressed="${ui.filter === v}" data-act="filter:${key}:${esc(v)}">${esc(l)}<b>${count(v)}</b></button>`).join('')}
      </div>`;
    }
    if (items.length > 8 || ui.q) {
      html += `<label class="search">${P.icon('search')}<span class="vh-only">Search ${esc(c.label.toLowerCase())}</span>
        <input type="search" data-search="${key}" value="${esc(ui.q)}" placeholder="Search ${esc(c.label.toLowerCase())}…" autocomplete="off"></label>`;
    }
    html += `<div data-list="${key}">${listBody(key)}</div>`;
    if (o.bottom) html += o.bottom(items);
    return html;
  };

  function listBody(key) {
    const c = cfg.collections[key];
    const ui = P.ui[key];
    let items = store.data[key].slice();
    if (!items.length) {
      return `<div class="empty"><p>${esc(c.empty)}</p><button class="btn ghost" data-act="add:${key}">${P.icon('plus')}Add ${esc(c.singular)}</button></div>`;
    }
    if (c.filter && ui.filter !== 'all') items = items.filter((it) => c.filter.get(it) === ui.filter);
    if (ui.q) {
      const q = ui.q.toLowerCase();
      items = items.filter((it) => (c.searchText ? c.searchText(it) : c.title(it)).toLowerCase().includes(q));
    }
    if (c.sort) items.sort(c.sort);
    if (!items.length) return `<p class="none">Nothing matches. Try another filter or search.</p>`;
    if (!c.group) return `<ul class="rows">${items.map((it) => P.row(key, it)).join('')}</ul>`;
    const groups = new Map();
    (c.groupOrder ? c.groupOrder() : []).forEach((g) => groups.set(g, []));
    items.forEach((it) => { const g = c.group(it); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it); });
    let html = '';
    groups.forEach((list, g) => {
      if (!list.length) return;
      html += `<h3 class="grp"><span>${esc(g)}</span>${c.groupMeta ? `<span>${c.groupMeta(list)}</span>` : ''}</h3><ul class="rows">${list.map((it) => P.row(key, it)).join('')}</ul>`;
    });
    return html;
  }
  P.listBody = listBody;

  P.row = function (key, it, extra = {}) {
    const c = cfg.collections[key];
    const done = c.check && it[c.check];
    const sub = (extra.subtitle || c.subtitle)?.(it);
    const meta = (extra.meta || c.meta)?.(it);
    const check = c.check
      ? `<button class="check" role="checkbox" aria-checked="${!!done}" aria-label="${esc(c.checkLabel || 'Done')}: ${esc(c.title(it))}" data-act="toggle:${key}:${it.id}:${c.check}"></button>`
      : '';
    return `<li class="row${done ? ' is-done' : ''}${extra.cls ? ' ' + extra.cls : ''}">${check}<button class="row-main" data-act="edit:${key}:${it.id}">
      <span class="row-t">${esc(c.title(it))}</span>${sub ? `<span class="row-s">${sub}</span>` : ''}</button>${meta ? `<span class="row-m">${meta}</span>` : ''}</li>`;
  };

  // ---------- relative checklist (tasks counted back from the big day)
  P.taskDue = (t, eventDate) => {
    if (t.due) return parseDate(t.due);
    const ev = parseDate(eventDate);
    return ev && t.days != null && t.days !== '' ? new Date(ev.getTime() - num(t.days) * DAY) : null;
  };
  P.checklistView = function (key, o) {
    const c = cfg.collections[key];
    const ui = (P.ui[key] ||= { filter: 'all', q: '', showDone: true });
    const ev = o.eventDate();
    const tasks = store.data[key];
    const done = tasks.filter((t) => t.done).length;
    const now = today();
    const daysOf = (t) => { const d = P.taskDue(t, ev); return d && ev ? Math.round((parseDate(ev) - d) / DAY) : num(t.days); };
    const periodOf = (t) => o.periods.find((p) => daysOf(t) >= p.days) || o.periods[o.periods.length - 1];
    const sorted = tasks.slice().sort((a, b) => daysOf(b) - daysOf(a));
    const late = ev ? sorted.filter((t) => !t.done && P.taskDue(t, ev) < now) : [];
    const lateIds = new Set(late.map((t) => t.id));
    const meta = (t) => { const d = P.taskDue(t, ev); return d ? `<span class="${lateIds.has(t.id) ? 'late' : ''}">${fmtDate(d)}</span>` : ''; };

    let html = `<header class="vh"><h1>${esc(c.label)}</h1>
      <button class="btn" data-act="add:${key}" aria-label="Add ${esc(c.singular)}">${P.icon('plus')}<span>Add</span></button></header>
      <p class="lede">${done} of ${tasks.length} done${ev ? '' : '. Add your date in Settings to see a due date on every task.'}</p>
      ${P.bar(done, tasks.length, `${done} of ${tasks.length} tasks done`)}
      <div class="chips"><button class="chip" aria-pressed="${!ui.showDone}" data-act="hideDone">Hide finished tasks</button></div>`;
    if (late.length) {
      html += `<h3 class="grp warn"><span>Catch up</span><span>${plural(late.length, 'task')}</span></h3>
        <ul class="rows">${late.map((t) => P.row(key, t, { meta })).join('')}</ul>`;
    }
    const groups = new Map(o.periods.map((p) => [p.label, []]));
    sorted.forEach((t) => { if (!lateIds.has(t.id) && (ui.showDone || !t.done)) groups.get(periodOf(t).label).push(t); });
    groups.forEach((list, label) => {
      if (!list.length) return;
      html += `<h3 class="grp"><span>${esc(label)}</span><span>${list.filter((t) => t.done).length}/${list.length}</span></h3>
        <ul class="rows">${list.map((t) => P.row(key, t, { meta })).join('')}</ul>`;
    });
    if (!tasks.length) html += `<div class="empty"><p>${esc(c.empty)}</p></div>`;
    return html;
  };
  P.actions.hideDone = () => { const k = Object.keys(P.ui).find((x) => 'showDone' in P.ui[x]); if (k) { P.ui[k].showDone = !P.ui[k].showDone; render(); } };

  // ---------- forms in a bottom sheet
  const optList = (f) => (typeof f.options === 'function' ? f.options() : f.options).map((o) => (Array.isArray(o) ? o : [o, o]));
  function fieldHtml(f, v) {
    const id = `f-${f.key}`;
    const cls = `fld${f.half ? ' half' : ''}`;
    const help = f.help ? `<small>${esc(f.help)}</small>` : '';
    if (f.type === 'check') {
      return `<label class="${cls} chk"><input type="checkbox" name="${f.key}" ${v ? 'checked' : ''}><span>${esc(f.label)}</span></label>`;
    }
    if (f.type === 'seg') {
      return `<fieldset class="${cls} seg"><legend>${esc(f.label)}</legend><div class="seg-o">${optList(f).map(([ov, ol]) =>
        `<label><input type="radio" name="${f.key}" value="${esc(ov)}" ${String(v ?? f.default ?? '') === String(ov) ? 'checked' : ''}><span>${esc(ol)}</span></label>`).join('')}</div></fieldset>`;
    }
    let input;
    if (f.type === 'select') {
      input = `<select id="${id}" name="${f.key}">${optList(f).map(([ov, ol]) => `<option value="${esc(ov)}" ${String(v ?? '') === String(ov) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea id="${id}" name="${f.key}" rows="3" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
    } else {
      const t = { money: 'number', number: 'number', date: 'date', email: 'email', tel: 'tel', url: 'url' }[f.type] || 'text';
      const extra = f.type === 'money' ? 'inputmode="decimal" step="0.01" min="0"' : f.type === 'number' ? 'inputmode="numeric" step="1"' : '';
      input = `<input id="${id}" name="${f.key}" type="${t}" ${extra} value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" autocomplete="off"${/^(email|url|tel)$/.test(f.type) ? ' spellcheck="false"' : ''}>`;
    }
    return `<div class="${cls}"><label for="${id}">${esc(f.label)}</label>${input}${help}</div>`;
  }
  function readFields(form, fields) {
    const out = {};
    fields.forEach((f) => {
      const el = form.elements[f.key];
      if (!el) return;
      if (f.type === 'check') out[f.key] = el.checked;
      else if (f.type === 'money' || f.type === 'number') out[f.key] = el.value === '' ? '' : num(el.value);
      else out[f.key] = String(el.value ?? '').trim();
    });
    return out;
  }

  P.form = function (o) {
    sheet.innerHTML = `<form class="sheet-f" novalidate>
      <header class="sheet-h"><h2 id="sheet-title" tabindex="-1">${esc(o.title)}</h2>${o.locked ? '' : `<button type="button" class="icon-btn" data-close aria-label="Close">${P.icon('close')}</button>`}</header>
      <div class="sheet-b">${o.intro ? `<p class="sheet-intro">${o.intro}</p>` : ''}<div class="fields">${(o.fields || []).map((f) => fieldHtml(f, o.values?.[f.key])).join('')}</div>${o.html || ''}</div>
      <footer class="sheet-a">
        ${o.onDelete ? `<button type="button" class="btn text-danger" data-del>${esc(o.deleteLabel || 'Delete')}</button>` : ''}
        <span class="sp"></span>
        ${o.again ? `<button type="submit" class="btn ghost" value="again">Save, add another</button>` : ''}
        ${o.submit === false ? '' : `<button type="submit" class="btn${o.danger ? ' danger' : ''}" value="ok">${esc(o.submit || 'Save')}</button>`}
      </footer></form>`;
    const form = sheet.querySelector('form');
    let dirty = false;
    form.addEventListener('input', () => { dirty = true; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const vals = readFields(form, o.fields || []);
      const missing = (o.fields || []).find((f) => f.required && !String(vals[f.key] ?? '').trim());
      if (missing) {
        form.querySelector('.err')?.remove();
        const el = form.elements[missing.key];
        el.insertAdjacentHTML('afterend', `<small class="err" role="alert">Add ${esc(missing.label.toLowerCase())} to continue.</small>`);
        el.focus();
        return;
      }
      const again = e.submitter?.value === 'again';
      if (!again) sheet.close();
      o.onSubmit?.(vals, again);
      if (again) { form.reset(); dirty = false; form.querySelector('input,select,textarea')?.focus(); }
    });
    form.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => sheet.close()));
    form.querySelector('[data-del]')?.addEventListener('click', () => {
      sheet.close();
      P.confirm({ title: o.deleteTitle || 'Delete this?', body: o.deleteBody || 'This can’t be undone.', ok: o.deleteLabel || 'Delete', danger: true }).then((yes) => yes && o.onDelete());
    });
    sheet.oncancel = (e) => { if (o.locked) e.preventDefault(); };
    sheet.onclick = (e) => { if (e.target === sheet && !o.locked && !dirty) sheet.close(); };
    if (!sheet.open) sheet.showModal();
    o.after?.(form);
    if (matchMedia('(pointer:fine)').matches) form.querySelector('.fields input, .fields select, .fields textarea')?.focus();
    else form.querySelector('h2').focus?.();
  };

  P.confirm = (o) => new Promise((resolve) => {
    let answered = false;
    P.form({ title: o.title, intro: esc(o.body), submit: o.ok || 'OK', danger: o.danger, onSubmit: () => { answered = true; resolve(true); } });
    sheet.addEventListener('close', () => { if (!answered) resolve(false); }, { once: true });
  });

  P.edit = function (key, id, preset) {
    const c = cfg.collections[key];
    const list = store.data[key];
    const existing = id ? list.find((x) => x.id === id) : null;
    const values = existing ? { ...existing } : { ...(c.blank ? c.blank() : {}), ...(preset || {}) };
    const fields = typeof c.fields === 'function' ? c.fields() : c.fields;
    P.form({
      title: existing ? `Edit ${c.singular}` : `Add ${c.singular}`,
      fields,
      values,
      submit: existing ? 'Save changes' : `Add ${c.singular}`,
      again: !existing && c.addAnother,
      deleteLabel: `Delete ${c.singular}`,
      deleteTitle: `Delete this ${c.singular}?`,
      onDelete: existing ? () => { store.data[key] = list.filter((x) => x.id !== id); store.save(); P.toast(`${cap(c.singular)} deleted`); } : null,
      onSubmit: (vals) => {
        if (existing) Object.assign(existing, vals);
        else list.push({ ...(c.blank ? c.blank() : {}), ...(preset || {}), ...vals, id: uid() });
        store.save();
        P.toast(existing ? 'Changes saved' : `${cap(c.singular)} added`);
      },
    });
  };

  P.toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2400);
  };

  // ---------- setup, backup, export
  P.openSetup = function (first) {
    const st = cfg.setup;
    P.form({
      title: first ? st.title : 'Your details',
      intro: first ? st.intro : '',
      fields: st.fields(),
      values: { currency: P.guessCurrency(), ...S() },
      submit: first ? st.submit : 'Save changes',
      locked: first,
      onSubmit: (vals) => {
        const wasNew = !S().onboarded;
        Object.assign(S(), vals, { onboarded: true });
        st.apply?.(store.data, vals, wasNew);
        if (wasNew) navigator.storage?.persist?.().catch(() => {});
        store.save();
        if (!wasNew) P.toast('Changes saved');
      },
    });
  };

  P.download = (name, text, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  P.actions.backup = () => {
    S().lastBackup = iso(today());
    store.save();
    P.download(`${cfg.fileSlug}-backup-${iso(today())}.json`, JSON.stringify({ app: cfg.id, version: 1, saved: new Date().toISOString(), data: store.data }), 'application/json');
    P.toast('Backup saved to your downloads');
  };
  P.actions.restore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      file.text().then((t) => {
        let obj;
        try { obj = JSON.parse(t); } catch (e) { obj = null; }
        if (!obj || obj.app !== cfg.id || typeof obj.data !== 'object') {
          P.toast(`That file isn’t a ${cfg.name} backup.`);
          return;
        }
        P.confirm({ title: 'Restore this backup?', body: `Everything in this planner will be replaced with the backup from ${fmtDate(obj.saved?.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}.`, ok: 'Replace and restore', danger: true })
          .then((yes) => { if (yes) { store.replace(obj.data); P.toast('Backup restored'); } });
      });
    };
    input.click();
  };
  P.actions.reset = () => {
    P.confirm({ title: 'Erase everything?', body: 'Every list in this planner will be deleted from this device. Download a backup first if you might want it back.', ok: 'Erase everything', danger: true })
      .then((yes) => { if (yes) { store.reset(); P.openSetup(true); } });
  };
  P.actions.setup = () => P.openSetup(false);
  P.actions.install = () => { P.installEvent?.prompt(); P.installEvent = null; };

  P.csv = (name, cols, rows) => {
    const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const text = [cols.map((c) => cell(c[0])), ...rows.map((r) => cols.map((c) => cell(c[1](r))))].map((r) => r.join(',')).join('\r\n');
    P.download(name, '﻿' + text, 'text/csv');
  };

  P.settingsView = function (extra = '') {
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const last = S().lastBackup;
    return `<header class="vh"><h1>Settings</h1></header>
      <section class="sec"><div class="sec-h"><h2>Your details</h2></div>
        <p class="lede">${cfg.setup.summary(S())}</p>
        <button class="btn ghost" data-act="setup">Edit details</button></section>
      ${extra}
      <section class="sec"><div class="sec-h"><h2>Back up your planner</h2></div>
        <p class="lede">Your planner is saved on this device only. Nothing is uploaded anywhere. Download a backup now and then, and use it to move your planner to another phone or computer.</p>
        <p class="note">${last ? `Last backup: ${fmtDate(last, { day: 'numeric', month: 'long', year: 'numeric' })}` : 'No backup yet.'}</p>
        <div class="btns"><button class="btn" data-act="backup">${P.icon('download')}Download backup</button><button class="btn ghost" data-act="restore">Restore a backup</button></div></section>
      <section class="sec"><div class="sec-h"><h2>Add to your home screen</h2></div>
        ${standalone ? '<p class="lede">You’re using the installed app. It works offline.</p>'
          : P.installEvent ? '<p class="lede">Install the planner so it opens like an app and works offline.</p><button class="btn" data-act="install">Install app</button>'
          : ios ? '<p class="lede">In Safari, tap the Share button, then <b>Add to Home Screen</b>. The planner will open like an app and work offline.</p>'
          : '<p class="lede">In Chrome, open the menu and choose <b>Install app</b> or <b>Add to Home screen</b>. The planner will open like an app and work offline.</p>'}</section>
      <section class="sec"><div class="sec-h"><h2>Start over</h2></div>
        <p class="lede">Erase every list on this device and start a fresh planner.</p>
        <button class="btn text-danger" data-act="reset">Erase everything</button></section>`;
  };

  P.backupNudge = () => {
    const d = store.data;
    const filled = Object.values(d).some((v) => Array.isArray(v) && v.some((x) => x.custom !== false && !x.seed));
    const last = S().lastBackup;
    if (!filled || (last && daysUntil(last) > -30)) return '';
    return `<div class="nudge"><p>${last ? 'It’s been a while since your last backup.' : 'Your planner lives on this device only.'} Download a backup so nothing gets lost.</p><button class="btn ghost" data-act="backup">${P.icon('download')}Download backup</button></div>`;
  };
})();
