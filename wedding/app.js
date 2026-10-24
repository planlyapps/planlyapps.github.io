/* Wedding Planner: sections, lists and starter content for the Planly engine. */
(function () {
  'use strict';
  const P = window.Planly;
  const { esc, fmtDate, num, plural } = P;
  const D = () => P.store.data;
  const S = () => D().settings;
  const sum = (list, f) => list.reduce((t, x) => t + num(f(x)), 0);
  const UK = /-(gb|ie|au|nz)$/i.test(navigator.language || '');
  const SUPPLIER = UK ? 'supplier' : 'vendor';
  const name1 = () => S().name1 || 'Partner 1';
  const name2 = () => S().name2 || 'Partner 2';

  const TASKS = [
    [365, 'Agree your overall budget'], [365, 'Draft a first guest list'], [365, 'Choose a date and season'], [365, 'Visit and book your venue'],
    [365, 'Book your officiant or registrar'], [330, 'Book your photographer'],
    [300, 'Choose your wedding party'], [300, 'Book a caterer, if the venue doesn’t provide one'], [300, 'Book your band or DJ'], [300, 'Book a videographer'],
    [240, 'Start shopping for wedding outfits'], [240, 'Book your florist'], [240, 'Book hair and makeup'], [240, 'Plan and book the honeymoon'], [240, 'Reserve hotel rooms for guests'],
    [180, 'Send save the dates'], [180, 'Order outfits for the wedding party'], [180, 'Book wedding transport'], [180, 'Taste and order the cake'], [180, 'Set up a gift list'],
    [120, 'Order invitations'], [120, 'Buy your wedding rings'], [120, 'Plan the ceremony readings and music'], [120, 'Book the rehearsal dinner'],
    [90, 'Sort the legal paperwork (licence or notice of marriage)'], [90, 'Book outfit fittings'], [90, 'Finalise the menu'], [90, 'Buy gifts for the wedding party'], [90, 'Order favours'],
    [60, 'Send invitations'], [60, 'Have a hair and makeup trial'], [60, 'Write your vows'], [60, 'Plan the order of the day'],
    [30, 'Chase missing RSVPs'], [30, 'Finish the seating plan'], [30, 'Give final numbers to the caterer'], [30, `Confirm times with every ${SUPPLIER}`], [30, 'Have your final outfit fitting'], [30, 'Break in your wedding shoes'],
    [14, 'Pay the final balances'], [14, 'Print place cards and the table plan'], [14, 'Put tips and payments in envelopes'],
    [7, 'Pack for the honeymoon'], [7, 'Hold the rehearsal'], [7, 'Share the order of the day with your wedding party'], [7, 'Pack an emergency kit'],
    [1, 'Drop decorations at the venue'], [1, 'Get an early night'],
    [-7, 'Return hired outfits and items'], [-14, 'Send thank-you cards'], [-30, 'Update your name on documents, if you’re changing it'],
  ];
  const PERIODS = [
    { days: 330, label: '12 months before' }, { days: 270, label: '10 months before' }, { days: 210, label: '8 months before' },
    { days: 150, label: '6 months before' }, { days: 105, label: '4 months before' }, { days: 75, label: '3 months before' },
    { days: 45, label: '2 months before' }, { days: 21, label: '1 month before' }, { days: 10, label: '2 weeks before' },
    { days: 1, label: 'The final week' }, { days: 0, label: 'On the day' }, { days: -1e6, label: 'After the wedding' },
  ];
  const COSTS = [
    ['Venue and food', 'Venue hire', 20], ['Venue and food', 'Food and drink', 25],
    ['Photo and video', 'Photographer', 7], ['Photo and video', 'Videographer', 3],
    ['Outfits and rings', 'Wedding outfits', 7], ['Outfits and rings', 'Rings', 4],
    ['Flowers and decor', 'Flowers', 5], ['Flowers and decor', 'Decor and hire', 3],
    ['Music', 'Band or DJ', 6], ['Hair and makeup', 'Hair and makeup', 2], ['Stationery', 'Invitations and stationery', 2],
    ['Cake and favours', 'Cake', 2], ['Cake and favours', 'Favours and gifts', 2],
    ['Transport', 'Transport', 2], ['Ceremony', 'Officiant and legal fees', 2], ['Contingency', 'Contingency', 8],
  ];
  const CATEGORIES = [...new Set(COSTS.map((c) => c[0])), 'Other'];
  const RSVP = [['waiting', 'Waiting'], ['yes', 'Attending'], ['no', 'Declined']];
  const STATUS = [['looking', 'Researching'], ['quoted', 'Quote in'], ['booked', 'Booked']];

  // ---------- money and people
  const forecast = (b) => (b.actual !== '' && b.actual != null ? num(b.actual) : num(b.estimate));
  const owed = (b) => Math.max(num(b.actual) - num(b.paid), 0);
  const people = (g) => 1 + (g.plusOne ? 1 : 0);
  const tableName = (id) => D().tables.find((t) => t.id === id)?.name || '';
  function allocate() {
    const total = num(S().budget);
    D().budget.forEach((b) => { if (b.pct && (b.estimate === '' || b.estimate == null)) b.estimate = Math.round((total * b.pct) / 100 / 10) * 10; });
  }

  // ---------- views
  function homeView() {
    const s = S();
    const d = P.daysUntil(s.date);
    const [count, countLabel] = d == null ? [null] : d > 1 ? [d.toLocaleString(), 'days to go'] : d === 1 ? ['1', 'day to go'] : d === 0 ? ['Today', 'is the day'] : [Math.abs(d).toLocaleString(), 'days married'];
    const names = [s.name1, s.name2].filter(Boolean);
    let html = `<section class="invite" aria-label="Your wedding">
      <h1 class="names">${names.length ? names.map(esc).join(' &amp; ') : 'Our wedding'}</h1>
      ${s.date ? `<p class="when">${esc(fmtDate(s.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</p>` : ''}
      ${s.venue ? `<p class="where">${esc(s.venue)}</p>` : ''}
      ${count ? `<p class="count">${count}</p><p class="count-l">${countLabel}</p>` : `<button class="btn ghost edit" data-act="setup">Add your wedding date</button>`}
    </section>`;
    html += P.backupNudge();

    const tasks = D().tasks.filter((t) => !t.done);
    if (D().tasks.length) {
      const next = tasks.map((t) => [t, P.taskDue(t, s.date)]).sort((a, b) => (a[1] || 0) - (b[1] || 0)).slice(0, 4);
      const now = P.today();
      html += `<section class="sec"><div class="sec-h"><h2>Coming up</h2><a href="#checklist">All tasks</a></div>
        ${next.length ? `<ul class="rows">${next.map(([t, due]) => P.row('tasks', t, { meta: () => (due ? `<span class="${due < now ? 'late' : ''}">${fmtDate(due)}</span>` : '') })).join('')}</ul>`
          : '<p class="lede">Every task is done. Enjoy it.</p>'}</section>`;
    }

    const items = D().budget;
    const total = num(s.budget);
    const planned = sum(items, forecast);
    const paid = sum(items, (b) => b.paid);
    html += `<section class="sec"><div class="sec-h"><h2>Budget</h2><a href="#budget">Details</a></div>
      ${total ? `<p class="money-line"><span><b>${P.money(planned)}</b> planned of ${P.money(total)}</span><span>${planned > total ? `${P.money(planned - total)} over` : `${P.money(total - planned)} spare`}</span></p>${P.bar(planned, total, `${P.money(planned)} planned of ${P.money(total)}`)}` : '<p class="lede">Add your total budget in Settings to track spending against it.</p>'}
      <p class="money-line"><span>Paid so far <b>${P.money(paid)}</b></span><span>Still to pay <b>${P.money(sum(items, owed))}</b></span></p></section>`;

    const due = items.filter((b) => b.due && owed(b) > 0).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 3);
    if (due.length) {
      html += `<section class="sec"><div class="sec-h"><h2>Payments due</h2></div><ul class="rows">${due.map((b) => P.row('budget', b, {
        subtitle: () => `Due ${esc(fmtDate(b.due, { day: 'numeric', month: 'long' }))}`,
        meta: () => P.money(owed(b)),
      })).join('')}</ul></section>`;
    }

    const g = D().guests;
    html += `<section class="sec"><div class="sec-h"><h2>Guests</h2><a href="#guests">Guest list</a></div>
      ${g.length ? guestFigs(g) : '<p class="lede">Your guest list is empty. Add guests to track RSVPs, meals and seating.</p>'}</section>`;
    return html;
  }

  function guestFigs(g) {
    const n = (r) => sum(g.filter((x) => x.rsvp === r), people);
    return `<dl class="figs"><div><dt>invited</dt><dd>${sum(g, people)}</dd></div><div><dt>attending</dt><dd>${n('yes')}</dd></div><div><dt>waiting</dt><dd>${n('waiting')}</dd></div><div><dt>declined</dt><dd>${n('no')}</dd></div></dl>`;
  }

  function budgetView() {
    const items = D().budget;
    const total = num(S().budget);
    const planned = sum(items, forecast);
    const blank = items.every((b) => b.estimate === '' || b.estimate == null);
    return P.listView('budget', {
      top: () => `<dl class="stats">
          <div class="stat"><dt>Total budget</dt><dd>${total ? P.money(total) : '–'}</dd></div>
          <div class="stat"><dt>Planned</dt><dd>${P.money(planned)}</dd></div>
          <div class="stat"><dt>Paid so far</dt><dd>${P.money(sum(items, (b) => b.paid))}</dd></div>
          <div class="stat"><dt>Still to pay</dt><dd>${P.money(sum(items, owed))}</dd></div></dl>
        ${total ? P.bar(planned, total, `${P.money(planned)} planned of ${P.money(total)}`) : ''}
        ${!total ? '<div class="nudge"><p>Add your total budget to see how your costs add up against it.</p><button class="btn ghost" data-act="setup">Add total budget</button></div>'
          : blank ? '<div class="nudge"><p>Split your budget across typical wedding costs to get starting estimates. You can change every figure.</p><button class="btn ghost" data-act="split">Split my budget</button></div>' : ''}`,
      bottom: () => (items.length ? `<p class="sec"><button class="btn ghost" data-act="budgetCsv">${P.icon('download')}Download as a spreadsheet</button></p>` : ''),
    });
  }

  function guestsView() {
    return P.listView('guests', {
      title: 'Guest list',
      top: (g) => (g.length ? guestFigs(g) + '<div style="height:18px"></div>' : ''),
      bottom: (g) => (g.length ? `<p class="sec"><button class="btn ghost" data-act="guestCsv">${P.icon('download')}Download as a spreadsheet</button></p>` : ''),
    });
  }

  function seatingView() {
    const tables = D().tables;
    const guests = D().guests.filter((g) => g.rsvp !== 'no');
    const seated = guests.filter((g) => g.table && tables.some((t) => t.id === g.table));
    const select = (g) => `<select class="seat-sel" aria-label="Table for ${esc(g.name)}" data-change="set:guests:${g.id}:table">
      <option value="">No table</option>${tables.map((t) => `<option value="${t.id}" ${g.table === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`;
    const guestRow = (g) => P.row('guests', g, { meta: () => select(g), subtitle: () => (g.plusOne ? `With ${esc(g.plusName || 'a plus-one')}` : '') });
    let html = `<header class="vh"><h1>Seating</h1><button class="btn" data-act="add:tables" aria-label="Add table">${P.icon('plus')}<span>Add</span></button></header>`;
    if (!tables.length) {
      return html + `<div class="empty"><p>Add your tables, then give each guest a seat. Declined guests are left out automatically.</p><button class="btn ghost" data-act="add:tables">${P.icon('plus')}Add table</button></div>`;
    }
    html += `<p class="lede">${sum(seated, people)} of ${sum(guests, people)} guests have a seat.</p>`;
    tables.forEach((t) => {
      const at = guests.filter((g) => g.table === t.id);
      const used = sum(at, people);
      const cap = num(t.seats);
      html += `<div class="table-h${cap && used > cap ? ' over' : cap && used === cap ? ' full' : ''}"><button data-act="edit:tables:${t.id}">${esc(t.name)}</button><span>${used} of ${cap || '?'} seats</span></div>
        ${at.length ? `<ul class="rows">${at.map(guestRow).join('')}</ul>` : '<p class="note" style="padding-top:10px">No one here yet.</p>'}`;
    });
    const loose = guests.filter((g) => !seated.includes(g));
    if (loose.length) html += `<h3 class="grp warn"><span>Still to seat</span><span>${plural(sum(loose, people), 'guest')}</span></h3><ul class="rows">${loose.map(guestRow).join('')}</ul>`;
    return html;
  }

  // ---------- actions
  P.actions.split = () => { allocate(); P.store.save(); P.toast('Budget split across typical costs'); };
  P.actions.guestCsv = () => P.csv('guest-list.csv', [
    ['Name', (g) => g.name], ['Plus-one', (g) => (g.plusOne ? g.plusName || 'Yes' : '')], ['RSVP', (g) => (RSVP.find((r) => r[0] === g.rsvp) || [])[1]],
    ['Side', (g) => ({ a: name1(), b: name2(), both: 'Both' })[g.side] || ''], ['Group', (g) => g.group], ['Invited to', (g) => (g.invite === 'evening' ? 'Evening only' : 'All day')],
    ['Meal', (g) => g.meal], ['Dietary needs', (g) => g.diet], ['Table', (g) => tableName(g.table)], ['Address', (g) => g.address], ['Notes', (g) => g.notes],
  ], D().guests);
  P.actions.budgetCsv = () => P.csv('wedding-budget.csv', [
    ['Category', (b) => b.category], ['Item', (b) => b.item], ['Estimate', (b) => b.estimate], ['Agreed price', (b) => b.actual], ['Paid', (b) => b.paid], ['Still to pay', owed], ['Balance due', (b) => b.due], ['Notes', (b) => b.notes],
  ], D().budget);

  // ---------- app definition
  P.start({
    id: 'planly-wedding',
    name: 'Wedding Planner',
    storageKey: 'planly-wedding-v1',
    fileSlug: 'wedding-planner',
    icons: {
      home: '<path d="M4 10.5 12 4l8 6.5"/><path d="M6 9v11h12V9"/><path d="M10 20v-6h4v6"/>',
      tasks: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12.2 2.4 2.4 4.6-5.1"/>',
      budget: '<path d="M4.5 8V6.8A1.8 1.8 0 0 1 6.3 5H17v3"/><rect x="4" y="8" width="16" height="11" rx="2"/><path d="M15 13.5h2"/>',
      guests: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M15.6 14.1c2.6-.3 4.5 1.4 4.9 4.4"/>',
      vendors: '<path d="M4 9.5h16l-1.4-4.5H5.4z"/><path d="M5.5 9.5V19h13V9.5"/><path d="M10 19v-5h4v5"/>',
      seating: '<circle cx="12" cy="12" r="4"/><circle cx="12" cy="4.6" r="1.4"/><circle cx="12" cy="19.4" r="1.4"/><circle cx="4.6" cy="12" r="1.4"/><circle cx="19.4" cy="12" r="1.4"/>',
    },
    defaults: () => ({
      settings: { onboarded: false },
      tasks: TASKS.map(([days, title]) => ({ id: P.uid(), title, days, done: false, seed: true })),
      budget: COSTS.map(([category, item, pct]) => ({ id: P.uid(), category, item, pct, estimate: '', actual: '', paid: '', due: '', seed: true })),
      guests: [],
      vendors: [],
      tables: [],
    }),
    sections: [
      { id: 'home', label: 'Home', icon: 'home', tab: true, view: homeView },
      { id: 'checklist', label: 'Checklist', icon: 'tasks', tab: true, view: () => P.checklistView('tasks', { eventDate: () => S().date, periods: PERIODS }) },
      { id: 'budget', label: 'Budget', icon: 'budget', tab: true, view: budgetView },
      { id: 'guests', label: 'Guests', icon: 'guests', tab: true, view: guestsView },
      { id: 'vendors', label: UK ? 'Suppliers' : 'Vendors', hint: 'Contacts, quotes and bookings', icon: 'vendors', view: () => P.listView('vendors') },
      { id: 'seating', label: 'Seating', hint: 'Tables and who sits where', icon: 'seating', view: seatingView },
      { id: 'settings', label: 'Settings', hint: 'Your details, backups and install', icon: 'settings', view: () => P.settingsView() },
    ],
    collections: {
      tasks: {
        label: 'Checklist', singular: 'task', check: 'done', checkLabel: 'Done',
        empty: 'Your checklist is empty. Add the tasks you want to keep track of.',
        title: (t) => t.title,
        subtitle: (t) => (t.notes ? esc(t.notes.length > 70 ? t.notes.slice(0, 70) + '…' : t.notes) : ''),
        fields: [
          { key: 'title', label: 'Task', required: true },
          { key: 'due', label: 'Due date', type: 'date', help: 'Leave blank to keep the suggested date.' },
          { key: 'notes', label: 'Notes', type: 'textarea' },
          { key: 'done', label: 'Done', type: 'check' },
        ],
      },
      budget: {
        label: 'Budget', singular: 'cost',
        empty: 'Add each cost as you book it: the venue, the photographer, the cake.',
        title: (b) => b.item,
        subtitle: (b) => {
          const bits = [];
          if (b.actual !== '' && b.actual != null) bits.push(num(b.paid) >= num(b.actual) && num(b.actual) > 0 ? 'Paid in full' : `${P.money(b.paid)} paid of ${P.money(b.actual)}`);
          if (b.due && owed(b) > 0) bits.push(`balance due ${fmtDate(b.due)}`);
          return esc(bits.join(', '));
        },
        meta: (b) => (b.actual !== '' && b.actual != null ? P.money(b.actual) : num(b.estimate) ? `<span class="note">est.</span> ${P.money(b.estimate)}` : '<span class="note">No estimate</span>'),
        group: (b) => b.category || 'Other',
        groupOrder: () => CATEGORIES,
        groupMeta: (list) => P.money(sum(list, forecast)),
        searchText: (b) => `${b.item} ${b.category} ${b.notes || ''}`,
        blank: () => ({ category: 'Other' }),
        fields: () => [
          { key: 'item', label: 'What it’s for', required: true, placeholder: 'Photographer' },
          { key: 'category', label: 'Category', type: 'select', options: CATEGORIES },
          { key: 'estimate', label: 'Estimate', type: 'money', half: true },
          { key: 'actual', label: 'Agreed price', type: 'money', half: true, help: 'Once it’s booked.' },
          { key: 'paid', label: 'Paid so far', type: 'money', half: true },
          { key: 'due', label: 'Balance due', type: 'date', half: true },
          { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
      },
      guests: {
        label: 'Guests', singular: 'guest', addAnother: true,
        empty: 'Start with the people you can’t imagine the day without. You can add the rest later.',
        title: (g) => g.name,
        subtitle: (g) => esc([g.plusOne ? `+ ${g.plusName || 'plus-one'}` : '', g.group, g.invite === 'evening' ? 'evening only' : '', tableName(g.table)].filter(Boolean).join(', ')),
        meta: (g) => `<span class="pill ${g.rsvp === 'yes' ? 'good' : g.rsvp === 'no' ? 'quiet' : ''}">${(RSVP.find((r) => r[0] === g.rsvp) || RSVP[0])[1]}</span>`,
        filter: { get: (g) => g.rsvp || 'waiting', options: RSVP, weight: people },
        sort: (a, b) => String(a.name).localeCompare(String(b.name)),
        searchText: (g) => `${g.name} ${g.plusName || ''} ${g.group || ''}`,
        blank: () => ({ rsvp: 'waiting', side: 'both', invite: 'day', group: 'Family' }),
        fields: () => [
          { key: 'name', label: 'Name', required: true },
          { key: 'rsvp', label: 'RSVP', type: 'seg', options: RSVP, default: 'waiting' },
          { key: 'side', label: 'Whose guest', type: 'seg', options: [['a', name1()], ['b', name2()], ['both', 'Both']], default: 'both' },
          { key: 'group', label: 'Group', type: 'select', half: true, options: ['Family', 'Friends', 'Work', 'Neighbours', 'Other'] },
          { key: 'invite', label: 'Invited to', type: 'select', half: true, options: [['day', 'All day'], ['evening', 'Evening only']] },
          { key: 'plusOne', label: 'Bringing a plus-one', type: 'check' },
          { key: 'plusName', label: 'Plus-one’s name', placeholder: 'Optional' },
          { key: 'meal', label: 'Meal choice', half: true },
          { key: 'diet', label: 'Dietary needs', half: true },
          { key: 'table', label: 'Table', type: 'select', options: () => [['', 'No table'], ...D().tables.map((t) => [t.id, t.name])] },
          { key: 'address', label: 'Address for invitations', type: 'textarea' },
          { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
      },
      vendors: {
        label: UK ? 'Suppliers' : 'Vendors', singular: SUPPLIER,
        empty: `Keep every ${SUPPLIER}’s contact details, quote and booking status in one place.`,
        title: (v) => v.name,
        subtitle: (v) => esc([v.type, v.contact, v.phone].filter(Boolean).join(', ')),
        meta: (v) => `${v.quote ? P.money(v.quote) + ' ' : ''}<span class="pill ${v.status === 'booked' ? 'good' : v.status === 'quoted' ? '' : 'quiet'}">${(STATUS.find((s) => s[0] === v.status) || STATUS[0])[1]}</span>`,
        filter: { get: (v) => v.status || 'looking', options: STATUS },
        sort: (a, b) => String(a.name).localeCompare(String(b.name)),
        searchText: (v) => `${v.name} ${v.type || ''} ${v.contact || ''}`,
        blank: () => ({ status: 'looking', type: 'Venue' }),
        fields: [
          { key: 'name', label: 'Business name', required: true },
          { key: 'type', label: 'Type', type: 'select', options: ['Venue', 'Caterer', 'Photographer', 'Videographer', 'Florist', 'Band or DJ', 'Hair and makeup', 'Cake', 'Stationery', 'Transport', 'Officiant', 'Outfits', 'Other'] },
          { key: 'status', label: 'Status', type: 'seg', options: STATUS, default: 'looking' },
          { key: 'contact', label: 'Contact name', half: true },
          { key: 'phone', label: 'Phone', type: 'tel', half: true },
          { key: 'email', label: 'Email', type: 'email', half: true },
          { key: 'website', label: 'Website', type: 'url', half: true },
          { key: 'quote', label: 'Quote', type: 'money', half: true },
          { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
      },
      tables: {
        label: 'Tables', singular: 'table',
        empty: 'No tables yet.',
        title: (t) => t.name,
        blank: () => ({ seats: 8 }),
        fields: [
          { key: 'name', label: 'Table name', required: true, placeholder: 'Table 1' },
          { key: 'seats', label: 'Seats', type: 'number' },
        ],
      },
    },
    setup: {
      title: 'Set up your planner',
      intro: 'Start with the basics. You can change any of this later in Settings.',
      submit: 'Start planning',
      fields: () => [
        { key: 'name1', label: 'Your name', half: true, required: true },
        { key: 'name2', label: 'Your partner’s name', half: true },
        { key: 'date', label: 'Wedding date', type: 'date', half: true, help: 'Leave blank if it isn’t set.' },
        { key: 'venue', label: 'Venue', half: true, placeholder: 'Optional' },
        { key: 'budget', label: 'Total budget', type: 'money', half: true, placeholder: 'Optional' },
        { key: 'currency', label: 'Currency', type: 'select', half: true, options: P.CURRENCIES },
      ],
      apply: (data, vals) => { if (num(vals.budget) > 0 && data.budget.every((b) => b.estimate === '' || b.estimate == null)) allocate(); },
      summary: (s) => esc([[s.name1, s.name2].filter(Boolean).join(' & '), s.date ? fmtDate(s.date, { day: 'numeric', month: 'long', year: 'numeric' }) : 'no date yet', s.venue, num(s.budget) ? `${P.money(s.budget)} budget` : ''].filter(Boolean).join(' · ')),
    },
  });
})();
