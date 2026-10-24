/* Christmas Planner: sections, lists and starter content for the Planly engine. */
(function () {
  'use strict';
  const P = window.Planly;
  const { esc, fmtDate, num, plural } = P;
  const D = () => P.store.data;
  const S = () => D().settings;
  const sum = (list, f) => list.reduce((t, x) => t + num(f(x)), 0);
  const UK = /-(gb|ie|au|nz)$/i.test(navigator.language || '');
  const GREETING = UK ? 'Happy Christmas' : 'Merry Christmas';

  // The Christmas this planner is counting towards. Until 6 January it is still last year's.
  function year() {
    const t = P.today();
    return t.getMonth() === 0 && t.getDate() <= 6 ? t.getFullYear() - 1 : t.getFullYear();
  }
  const christmas = () => `${year()}-12-25`;

  // Days before Christmas Day for each starter task
  const TASKS = [
    [60, 'Agree your Christmas budget'], [60, 'List everyone you’re buying for'], [60, 'Decide where you’re spending Christmas'], [60, 'Book any Christmas travel'],
    [50, 'Start the gift shopping'], [50, 'Book Christmas parties and meals out'], [50, 'Book time off work'],
    [45, 'Update your card list and addresses'], [45, 'Buy cards, wrapping paper and tape'], [45, 'Check the last posting dates'],
    [35, 'Post cards and parcels going abroad'], [35, 'Order your turkey or main from the butcher'], [35, 'Book a supermarket delivery slot'], [35, 'Plan the Christmas Day menu'],
    [28, 'Get the decorations down and check the lights'], [21, 'Write and post Christmas cards'], [21, 'Order online gifts before the delivery cut-off'],
    [14, 'Buy the tree and decorate'], [14, 'Finish the gift shopping'], [14, 'Stock up on drinks'], [14, 'Buy batteries for any gifts that need them'],
    [7, 'Confirm who’s coming and when'], [7, 'Plan the Christmas Day cooking times'], [7, 'Clear space in the fridge and freezer'], [7, 'Wrap presents'],
    [3, 'Collect the turkey or main'], [3, 'Start defrosting a frozen turkey'], [3, 'Buy the fresh food'], [3, 'Make up the spare beds'],
    [1, 'Prepare the vegetables'], [1, 'Lay the table'], [1, 'Fill the stockings'],
    [0, 'Put the turkey in'], [0, 'Enjoy the day'],
    [-3, 'Write thank-you notes'], [-12, 'Take the decorations down'], [-14, 'Recycle the tree'], [-14, 'Note what worked, for next year'],
  ];
  const PERIODS = [
    { days: 55, label: 'October' }, { days: 40, label: 'Early November' }, { days: 25, label: 'Late November' },
    { days: 11, label: 'Early December' }, { days: 2, label: 'Mid December' }, { days: 1, label: 'Christmas Eve' },
    { days: 0, label: 'Christmas Day' }, { days: -1e6, label: 'After Christmas' },
  ];
  // Starter budget lines, as a share of the total. Gifts come from the gift list, so they aren't here.
  const COSTS = [['Food and drink', 25], ['Travel', 8], ['Decorations and tree', 6], ['Going out', 6], ['Cards and postage', 3], ['Wrapping', 2], ['Contingency', 5]];
  const GIFT_STATUS = [['idea', 'Idea'], ['bought', 'Bought'], ['wrapped', 'Wrapped']];
  const MEALS = ['Christmas Eve', 'Christmas morning', 'Christmas dinner', 'Boxing Day', 'Other'];
  const MENU = [
    ['Christmas dinner', 'Roast turkey'], ['Christmas dinner', 'Roast potatoes'], ['Christmas dinner', 'Pigs in blankets'], ['Christmas dinner', 'Stuffing'],
    ['Christmas dinner', 'Sprouts and carrots'], ['Christmas dinner', 'Gravy and cranberry sauce'], ['Christmas dinner', 'Christmas pudding'],
  ];
  const WHEN = [['early', 'Buy early'], ['order', 'Order ahead'], ['fresh', 'Buy fresh, last few days']];
  const SHOPPING = [['early', 'Wrapping paper'], ['early', 'Sticky tape and gift tags'], ['early', 'Batteries'], ['early', 'Crackers'], ['early', 'Foil and baking paper'], ['order', 'Turkey or main']];

  // ---------- money and people
  const bought = (g) => g.status === 'bought' || g.status === 'wrapped';
  const giftsFor = (pid) => D().gifts.filter((g) => g.person === pid);
  const personName = (id) => D().people.find((p) => p.id === id)?.name || '';
  // Each person costs whichever is higher: the budget you set for them or the gifts you've chosen
  const giftPlan = () => D().people.reduce((t, p) => t + Math.max(num(p.budget), sum(giftsFor(p.id), (g) => g.price)), 0)
    + sum(D().gifts.filter((g) => !personName(g.person)), (g) => g.price);
  const giftSpent = () => sum(D().gifts.filter(bought), (g) => g.price);
  const otherPlan = () => sum(D().budget, (b) => (b.spent !== '' && b.spent != null && num(b.spent) > num(b.estimate) ? b.spent : b.estimate));
  const otherSpent = () => sum(D().budget, (b) => b.spent);
  function allocate() {
    const total = num(S().budget);
    D().budget.forEach((b) => { if (b.pct && (b.estimate === '' || b.estimate == null)) b.estimate = Math.round((total * b.pct) / 100 / 5) * 5; });
  }

  // ---------- views
  function homeView() {
    const s = S();
    const d = P.daysUntil(christmas());
    const [count, label] = d > 1 ? [d, 'sleeps till Christmas'] : d === 1 ? ['1', 'sleep till Christmas'] : d === 0 ? ['', GREETING] : ['', 'Hope it was a good one'];
    const g = D().gifts;
    const c = D().cards;
    const tag = [g.length ? `<span><b>${g.filter(bought).length}</b> of ${plural(g.length, 'gift')} bought</span>` : '',
      c.length ? `<span><b>${c.filter((x) => x.sent).length}</b> of ${plural(c.length, 'card')} sent</span>` : ''].filter(Boolean).join('');
    let html = `<section class="parcel" aria-label="Countdown">
      <h1 class="yr">Christmas ${year()}</h1>
      ${count !== '' ? `<p class="count">${count}</p>` : ''}<p class="count-l">${label}</p>
      ${tag ? `<p class="tag">${tag}</p>` : `<a class="btn ghost" href="#gifts">Start your gift list</a>`}
    </section>`;
    html += P.backupNudge();

    const now = P.today();
    const next = D().tasks.filter((t) => !t.done).map((t) => [t, P.taskDue(t, christmas())]).sort((a, b) => a[1] - b[1]).slice(0, 4);
    if (D().tasks.length) {
      html += `<section class="sec"><div class="sec-h"><h2>Coming up</h2><a href="#checklist">All tasks</a></div>
        ${next.length ? `<ul class="rows">${next.map(([t, due]) => P.row('tasks', t, { meta: () => `<span class="${due < now ? 'late' : ''}">${fmtDate(due)}</span>` })).join('')}</ul>`
          : '<p class="lede">Every task is done. Put your feet up.</p>'}</section>`;
    }

    const toBuy = g.filter((x) => !bought(x));
    html += `<section class="sec"><div class="sec-h"><h2>Still to buy</h2><a href="#gifts">All gifts</a></div>
      ${!g.length ? '<p class="lede">Add the people you’re buying for, then jot down gift ideas as they come to you.</p>'
        : toBuy.length ? `<ul class="rows">${toBuy.slice(0, 4).map((x) => P.row('gifts', x)).join('')}</ul>${toBuy.length > 4 ? `<p class="note" style="padding-top:10px">And ${plural(toBuy.length - 4, 'more gift')}.</p>` : ''}`
        : '<p class="lede">Every gift is bought. Time to wrap.</p>'}</section>`;

    const total = num(s.budget);
    const planned = giftPlan() + otherPlan();
    const spent = giftSpent() + otherSpent();
    html += `<section class="sec"><div class="sec-h"><h2>Budget</h2><a href="#budget">Details</a></div>
      ${total ? `<p class="money-line"><span><b>${P.money(spent)}</b> spent of ${P.money(total)}</span><span>${spent > total ? `${P.money(spent - total)} over` : `${P.money(total - spent)} left`}</span></p>${P.bar(spent, total, `${P.money(spent)} spent of ${P.money(total)}`)}
        <p class="money-line"><span>Planned so far <b>${P.money(planned)}</b></span><span>${planned > total ? `${P.money(planned - total)} over budget` : ''}</span></p>`
        : '<div class="nudge"><p>Add your Christmas budget to keep an eye on spending.</p><button class="btn ghost" data-act="setup">Add budget</button></div>'}</section>`;

    const shop = D().shopping;
    if (shop.length) {
      const left = shop.filter((x) => !x.got).length;
      html += `<section class="sec"><div class="sec-h"><h2>Shopping list</h2><a href="#shopping">Open list</a></div>
        <p class="lede">${left ? `${plural(left, 'thing')} still to get, out of ${shop.length}.` : 'You’ve got everything on the list.'}</p></section>`;
    }
    return html;
  }

  function giftsView() {
    const ui = (P.ui.gifts ||= { filter: 'all', q: '' });
    const people = D().people.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const gifts = D().gifts;
    let html = `<header class="vh"><h1>Gifts</h1>${people.length ? `<button class="btn" data-act="add:gifts" aria-label="Add gift">${P.icon('plus')}<span>Add</span></button>` : ''}</header>`;
    if (!people.length) {
      return html + `<div class="empty"><p>Start with everyone you’re buying for. Give each person a budget, then add gift ideas as they come to you.</p><button class="btn ghost" data-act="add:people">${P.icon('plus')}Add person</button></div>`;
    }
    const spent = giftSpent();
    html += `<p class="lede">${gifts.filter(bought).length} of ${plural(gifts.length, 'gift')} bought for ${plural(people.length, 'person', 'people')}. ${P.money(spent)} spent of ${P.money(giftPlan())} planned.</p>`;
    if (gifts.length) {
      const count = (v) => gifts.filter((x) => v === 'all' || (x.status || 'idea') === v).length;
      html += `<div class="chips" role="group" aria-label="Filter gifts">
        <button class="chip" aria-pressed="${ui.filter === 'all'}" data-act="filter:gifts:all">All<b>${count('all')}</b></button>
        ${GIFT_STATUS.map(([v, l]) => `<button class="chip" aria-pressed="${ui.filter === v}" data-act="filter:gifts:${v}">${l}<b>${count(v)}</b></button>`).join('')}</div>`;
    }
    const shown = (list) => list.filter((x) => ui.filter === 'all' || (x.status || 'idea') === ui.filter);
    people.forEach((p) => {
      const mine = giftsFor(p.id);
      const cost = sum(mine, (g) => g.price);
      const budget = num(p.budget);
      const list = shown(mine);
      html += `<div class="person-h${budget && cost > budget ? ' over' : ''}"><button data-act="edit:people:${p.id}" aria-label="Edit ${esc(p.name)}">${esc(p.name)}</button>
        <span>${budget ? `${P.money(cost)} of ${P.money(budget)}` : cost ? P.money(cost) : 'No budget set'}</span></div>
        ${list.length ? `<ul class="rows">${list.map((g) => P.row('gifts', g, { subtitle: (x) => esc(x.where || '') })).join('')}</ul>` : `<p class="note">${mine.length ? 'Nothing matches this filter.' : 'No gift ideas yet.'}</p>`}
        <button class="mini-add" data-act="giftFor:${p.id}">Add a gift for ${esc(p.name)}</button>`;
    });
    const loose = shown(gifts.filter((g) => !personName(g.person)));
    if (loose.length) html += `<h3 class="grp"><span>Not for anyone yet</span><span>${plural(loose.length, 'gift')}</span></h3><ul class="rows">${loose.map((g) => P.row('gifts', g)).join('')}</ul>`;
    html += `<div class="btns sec"><button class="btn ghost" data-act="add:people">${P.icon('plus')}Add person</button>
      ${gifts.length ? `<button class="btn ghost" data-act="giftCsv">${P.icon('download')}Download as a spreadsheet</button>` : ''}</div>`;
    return html;
  }

  function budgetView() {
    const total = num(S().budget);
    const planned = giftPlan() + otherPlan();
    const spent = giftSpent() + otherSpent();
    const blank = D().budget.every((b) => b.estimate === '' || b.estimate == null);
    return P.listView('budget', {
      top: () => `<dl class="stats">
          <div class="stat"><dt>Total budget</dt><dd>${total ? P.money(total) : '–'}</dd></div>
          <div class="stat"><dt>Planned</dt><dd>${P.money(planned)}</dd></div>
          <div class="stat"><dt>Spent so far</dt><dd>${P.money(spent)}</dd></div>
          <div class="stat"><dt>${total && spent > total ? 'Over budget' : 'Left to spend'}</dt><dd>${total ? P.money(Math.abs(total - spent)) : '–'}</dd></div></dl>
        ${total ? P.bar(spent, total, `${P.money(spent)} spent of ${P.money(total)}`) : ''}
        ${!total ? '<div class="nudge"><p>Add your Christmas budget to see your spending against it.</p><button class="btn ghost" data-act="setup">Add budget</button></div>'
          : blank ? `<div class="nudge"><p>Split your budget across typical Christmas costs to get starting estimates. About ${P.money(Math.round(total * 0.45))} is left over for gifts. You can change every figure.</p><button class="btn ghost" data-act="split">Split my budget</button></div>` : ''}
        <h3 class="grp"><span>Gifts</span><span>${P.money(giftPlan())}</span></h3>
        <ul class="rows"><li class="row"><a class="row-main row-link" href="#gifts"><span><span class="row-t">${D().people.length ? `Gifts for ${plural(D().people.length, 'person', 'people')}` : 'Your gift list'}</span><span class="row-s">${D().people.length ? `${P.money(giftSpent())} spent. Set budgets on your gift list.` : 'Add the people you’re buying for and give each a budget.'}</span></span></a>${P.icon('chevron')}</li></ul>
        <h3 class="grp"><span>Everything else</span><span>${P.money(otherPlan())}</span></h3>`,
      bottom: () => `<p class="sec"><button class="btn ghost" data-act="budgetCsv">${P.icon('download')}Download as a spreadsheet</button></p>`,
    });
  }

  // ---------- actions
  P.actions.split = () => { allocate(); P.store.save(); P.toast('Budget split across typical costs'); };
  P.actions.giftFor = (el, pid) => P.edit('gifts', null, { person: pid });
  P.actions.giftCsv = () => P.csv('christmas-gifts.csv', [
    ['For', (g) => personName(g.person)], ['Gift', (g) => g.idea], ['Price', (g) => g.price], ['Status', (g) => (GIFT_STATUS.find((s) => s[0] === g.status) || GIFT_STATUS[0])[1]], ['Where to buy', (g) => g.where], ['Notes', (g) => g.notes],
  ], D().gifts.slice().sort((a, b) => personName(a.person).localeCompare(personName(b.person))));
  P.actions.cardCsv = () => P.csv('christmas-card-list.csv', [
    ['Name', (c) => c.name], ['Address', (c) => c.address], ['Sent', (c) => (c.sent ? 'Yes' : '')], ['Card received', (c) => (c.received ? 'Yes' : '')], ['Notes', (c) => c.notes],
  ], D().cards.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))));
  P.actions.budgetCsv = () => P.csv('christmas-budget.csv', [['Item', (r) => r.item], ['Estimate', (r) => r.estimate], ['Spent', (r) => r.spent], ['Notes', (r) => r.notes]],
    [{ item: 'Gifts', estimate: giftPlan(), spent: giftSpent(), notes: 'From the gift list' }, ...D().budget]);

  // ---------- app definition
  P.start({
    id: 'planly-christmas',
    name: 'Christmas Planner',
    storageKey: 'planly-christmas-v1',
    fileSlug: 'christmas-planner',
    icons: {
      home: '<path d="M4 10.5 12 4l8 6.5"/><path d="M6 9v11h12V9"/><path d="M10 20v-6h4v6"/>',
      gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3.5 9h17M12 9v11"/><path d="M12 9c-1.2-3.4-5.2-4.4-5.2-1.8C6.8 8.6 9.6 9 12 9c2.4 0 5.2-.4 5.2-1.8 0-2.6-4-1.6-5.2 1.8"/>',
      tasks: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12.2 2.4 2.4 4.6-5.1"/>',
      budget: '<path d="M4.5 8V6.8A1.8 1.8 0 0 1 6.3 5H17v3"/><rect x="4" y="8" width="16" height="11" rx="2"/><path d="M15 13.5h2"/>',
      cards: '<rect x="3.5" y="6" width="17" height="12" rx="1.5"/><path d="m4 7 8 6 8-6"/>',
      menu: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="3.5"/><path d="M3 4v4.5a1.5 1.5 0 0 0 3 0V4M4.5 9.5V20M20.5 4c-1.6 1-2 3-2 5.5h2V20"/>',
      shopping: '<path d="M4 9h16l-1.6 9.2a1.5 1.5 0 0 1-1.5 1.3H7.1a1.5 1.5 0 0 1-1.5-1.3z"/><path d="m8.5 9 2-5M15.5 9l-2-5"/>',
    },
    defaults: () => ({
      settings: { onboarded: false },
      tasks: TASKS.map(([days, title]) => ({ id: P.uid(), title, days, done: false, seed: true })),
      people: [],
      gifts: [],
      cards: [],
      menu: MENU.map(([meal, dish]) => ({ id: P.uid(), meal, dish, seed: true })),
      shopping: SHOPPING.map(([when, item]) => ({ id: P.uid(), when, item, got: false, seed: true })),
      budget: COSTS.map(([item, pct]) => ({ id: P.uid(), item, pct, estimate: '', spent: '', seed: true })),
    }),
    sections: [
      { id: 'home', label: 'Home', icon: 'home', tab: true, view: homeView },
      { id: 'gifts', label: 'Gifts', icon: 'gift', tab: true, view: giftsView },
      { id: 'checklist', label: 'Countdown', icon: 'tasks', tab: true, view: () => P.checklistView('tasks', { eventDate: christmas, periods: PERIODS }) },
      { id: 'budget', label: 'Budget', icon: 'budget', tab: true, view: budgetView },
      { id: 'cards', label: 'Cards', hint: 'Who to send to, and who sent one', icon: 'cards', view: () => P.listView('cards', { bottom: (c) => (c.length ? `<p class="sec"><button class="btn ghost" data-act="cardCsv">${P.icon('download')}Download addresses as a spreadsheet</button></p>` : '') }) },
      { id: 'menu', label: 'Menu', hint: 'What you’re eating, and who’s bringing what', icon: 'menu', view: () => P.listView('menu', { top: () => (num(S().diners) ? `<p class="lede">Cooking for ${plural(num(S().diners), 'person', 'people')} on Christmas Day.</p>` : '') }) },
      { id: 'shopping', label: 'Shopping list', hint: 'Food and bits to buy, in the order you need them', icon: 'shopping', view: () => P.listView('shopping') },
      { id: 'settings', label: 'Settings', hint: 'Your budget, backups and install', icon: 'settings', view: () => P.settingsView() },
    ],
    collections: {
      tasks: {
        label: 'Countdown', singular: 'task', check: 'done', checkLabel: 'Done',
        empty: 'Your countdown is empty. Add the jobs you want to keep track of.',
        title: (t) => t.title,
        subtitle: (t) => (t.notes ? esc(t.notes.length > 70 ? t.notes.slice(0, 70) + '…' : t.notes) : ''),
        fields: [
          { key: 'title', label: 'Task', required: true },
          { key: 'due', label: 'Due date', type: 'date', help: 'Leave blank to keep the suggested date.' },
          { key: 'notes', label: 'Notes', type: 'textarea' },
          { key: 'done', label: 'Done', type: 'check' },
        ],
      },
      people: {
        label: 'People', singular: 'person', addAnother: true,
        empty: 'No one on your list yet.',
        title: (p) => p.name,
        fields: [
          { key: 'name', label: 'Name', required: true, placeholder: 'Mum' },
          { key: 'budget', label: 'Budget for their gifts', type: 'money', placeholder: 'Optional' },
          { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Sizes, likes, things they already have' },
        ],
      },
      gifts: {
        label: 'Gifts', singular: 'gift', addAnother: true,
        empty: 'No gifts yet.',
        title: (g) => g.idea,
        subtitle: (g) => esc([personName(g.person), g.where].filter(Boolean).join(', ')),
        meta: (g) => `${num(g.price) ? P.money(g.price) + ' ' : ''}<span class="pill ${g.status === 'wrapped' ? 'good' : g.status === 'bought' ? '' : 'quiet'}">${(GIFT_STATUS.find((s) => s[0] === g.status) || GIFT_STATUS[0])[1]}</span>`,
        blank: () => ({ status: 'idea' }),
        fields: () => [
          { key: 'idea', label: 'Gift', required: true, placeholder: 'A good cookbook' },
          { key: 'person', label: 'For', type: 'select', options: () => [['', 'Not decided'], ...D().people.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))).map((p) => [p.id, p.name])] },
          { key: 'status', label: 'Status', type: 'seg', options: GIFT_STATUS, default: 'idea' },
          { key: 'price', label: 'Price', type: 'money', half: true },
          { key: 'where', label: 'Where to buy', half: true, placeholder: 'Optional' },
          { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
      },
      cards: {
        label: 'Cards', singular: 'card', check: 'sent', checkLabel: 'Sent', addAnother: true,
        empty: 'Add everyone you send a card to. Next year the list will be ready and waiting.',
        title: (c) => c.name,
        subtitle: (c) => esc([c.address ? c.address.split('\n')[0] : '', c.received ? 'Sent you one' : ''].filter(Boolean).join(' · ')),
        filter: { get: (c) => (c.sent ? 'sent' : 'todo'), options: [['todo', 'To send'], ['sent', 'Sent']] },
        sort: (a, b) => String(a.name).localeCompare(String(b.name)),
        searchText: (c) => `${c.name} ${c.address || ''}`,
        fields: [
          { key: 'name', label: 'Who it’s for', required: true, placeholder: 'Auntie Jo and Phil' },
          { key: 'address', label: 'Address', type: 'textarea' },
          { key: 'sent', label: 'Card sent', type: 'check' },
          { key: 'received', label: 'They sent one to us', type: 'check' },
          { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
      },
      menu: {
        label: 'Menu', singular: 'dish', addAnother: true,
        empty: 'Plan what you’re eating over Christmas, and who’s bringing what.',
        title: (m) => m.dish,
        subtitle: (m) => esc([m.who ? `${m.who} is bringing it` : '', m.notes].filter(Boolean).join(', ')),
        group: (m) => m.meal || 'Other',
        groupOrder: () => MEALS,
        searchText: (m) => `${m.dish} ${m.who || ''} ${m.meal || ''}`,
        blank: () => ({ meal: 'Christmas dinner' }),
        fields: [
          { key: 'dish', label: 'Dish', required: true, placeholder: 'Roast potatoes' },
          { key: 'meal', label: 'Meal', type: 'select', options: MEALS },
          { key: 'who', label: 'Who’s making or bringing it', placeholder: 'Optional' },
          { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Recipe, timings, dietary needs' },
        ],
      },
      shopping: {
        label: 'Shopping list', singular: 'item', check: 'got', checkLabel: 'Got it', addAnother: true,
        empty: 'Add the food and bits you need to buy.',
        title: (s) => (s.qty ? `${s.item} (${s.qty})` : s.item),
        subtitle: (s) => esc(s.shop || ''),
        group: (s) => (WHEN.find((w) => w[0] === s.when) || WHEN[0])[1],
        groupOrder: () => WHEN.map((w) => w[1]),
        groupMeta: (list) => `${list.filter((s) => s.got).length}/${list.length}`,
        searchText: (s) => `${s.item} ${s.shop || ''}`,
        blank: () => ({ when: 'early' }),
        fields: [
          { key: 'item', label: 'Item', required: true, placeholder: 'Cranberry sauce' },
          { key: 'qty', label: 'How much', half: true, placeholder: 'Optional' },
          { key: 'shop', label: 'Shop', half: true, placeholder: 'Optional' },
          { key: 'when', label: 'When to buy it', type: 'seg', options: [['early', 'Early'], ['order', 'Order ahead'], ['fresh', 'Last few days']], default: 'early' },
          { key: 'got', label: 'Got it', type: 'check' },
        ],
      },
      budget: {
        label: 'Budget', singular: 'cost',
        empty: 'Add what you expect to spend on food, travel and the rest.',
        title: (b) => b.item,
        subtitle: (b) => (b.spent !== '' && b.spent != null ? esc(`${P.money(b.spent)} spent${num(b.estimate) ? ` of ${P.money(b.estimate)}` : ''}`) : ''),
        meta: (b) => (num(b.estimate) ? `<span class="note">est.</span> ${P.money(b.estimate)}` : '<span class="note">No estimate</span>'),
        fields: [
          { key: 'item', label: 'What it’s for', required: true, placeholder: 'Food and drink' },
          { key: 'estimate', label: 'Estimate', type: 'money', half: true },
          { key: 'spent', label: 'Spent so far', type: 'money', half: true },
          { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
      },
    },
    setup: {
      title: 'Set up your planner',
      intro: 'A few quick questions to get started. You can change them later in Settings.',
      submit: 'Start planning',
      fields: () => [
        { key: 'budget', label: 'Christmas budget', type: 'money', half: true, placeholder: 'Optional', help: 'Everything, gifts included.' },
        { key: 'currency', label: 'Currency', type: 'select', half: true, options: P.CURRENCIES },
        { key: 'diners', label: 'How many for Christmas dinner', type: 'number', placeholder: 'Optional' },
      ],
      apply: (data, vals) => { if (num(vals.budget) > 0 && data.budget.every((b) => b.estimate === '' || b.estimate == null)) allocate(); },
      summary: (s) => esc([`Christmas ${year()}`, num(s.budget) ? `${P.money(s.budget)} budget` : 'no budget set', num(s.diners) ? `${plural(num(s.diners), 'person', 'people')} for dinner` : ''].filter(Boolean).join(' · ')),
    },
  });
})();
