
importScripts('https://unpkg.com/dexie@3.2.3/dist/dexie.js');
import { renderExpenseList } from './src/renderExpenseList.js';

const db = new Dexie('LedgerDB');

db.version(1).stores({
  events: '++event_id,timestamp,eventType,aggregateId',
  projections: 'projection_key'
});

console.log('Database setup complete.');

const App = {
  generateUUID: function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  calculateChecksum: function(payload) {
    const str = JSON.stringify(payload);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  },

  _saveEvent: async function(eventType, aggregateId, payload) {
    const event = {
      timestamp: new Date().toISOString(),
      eventType: eventType,
      aggregateId: aggregateId,
      payload: payload,
      checksum: this.calculateChecksum(payload)
    };
    await db.events.add(event);
    console.log(`Event ${eventType} saved successfully.`);
  },

  saveGroupCreatedEvent: async function(groupName, groupMembers) {
    const aggregateId = this.generateUUID();
    const members = groupMembers.split(',').map(m => m.trim());
    const payload = { name: groupName, members };
    await this._saveEvent('GROUP_CREATED', aggregateId, payload);
    return aggregateId;
  },

  saveGroupDeletedEvent: async function(groupId) {
    await this._saveEvent('GROUP_DELETED', groupId, {});
  },

  saveExpenseAddedEvent: async function(groupId, description, amountCents, payerId, beneficiaries) {
    const postings = this.createExpenseTransaction(amountCents, payerId, beneficiaries);
    if (postings.length === 0) {
      console.log('No beneficiaries, skipping event creation.');
      return;
    }
    const payload = {
      expenseId: this.generateUUID(),
      description: description,
      amount: amountCents,
      payer: payerId,
      beneficiaries, // Now an array of objects
      postings: postings
    };
    await this._saveEvent('EXPENSE_ADDED', groupId, payload);
  },

  saveExpenseDeletedEvent: async function(groupId, expenseId) {
    await this._saveEvent('EXPENSE_DELETED', groupId, { expenseId });
  },

  createExpenseTransaction: function(amountCents, payerId, beneficiaries) {
    if (!beneficiaries || beneficiaries.length === 0) {
      return [];
    }

    const totalShares = beneficiaries.reduce((sum, b) => sum + b.amount, 0);
    const remainder = amountCents - totalShares;

    if (remainder !== 0) {
      beneficiaries[beneficiaries.length - 1].amount += remainder;
    }

    const postings = [];
    postings.push({ account: `Assets:Debtors:${payerId}`, credit: amountCents, debit: 0 });

    beneficiaries.forEach(beneficiary => {
      postings.push({ account: `Liabilities:Creditors:${beneficiary.id}`, debit: beneficiary.amount, credit: 0 });
    });

    postings.push({ account: 'Expenses:Clearing', debit: amountCents, credit: 0 });
    postings.push({ account: 'Expenses:Clearing', credit: amountCents, debit: 0 });

    const totalDebits = postings.reduce((sum, p) => sum + p.debit, 0);
    const totalCredits = postings.reduce((sum, p) => sum + p.credit, 0);
    if (totalDebits !== totalCredits) {
        throw new Error(`Ledger transaction is not balanced! Debits: ${totalDebits}, Credits: ${totalCredits}`);
    }

    return postings;
  },

  renderBalances: async function(groupId) {
    const groupListProjection = await db.projections.get('group_list');
    const group = groupListProjection.groups[groupId];
    if (!group) {
        return '<p>Group not found.</p>';
    }

    const balanceProjection = await db.projections.get(`group_balances_${groupId}`);
    if (!balanceProjection || !balanceProjection.balances) {
      return '<p>No balances calculated yet.</p>';
    }

    const formatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

    let balancesHtml = Object.entries(balanceProjection.balances).map(([memberId, balance]) => {
      const memberName = group.members[memberId];
      const netBalance = balance.net;
      const formattedBalance = formatter.format(netBalance / 100);
      const balanceClass = netBalance < 0 ? 'has-text-danger' : 'has-text-success';

      let text;
      if (netBalance > 0) {
        text = `${memberName} is owed ${formattedBalance}`;
      } else if (netBalance < 0) {
        text = `${memberName} owes ${formatter.format(Math.abs(netBalance / 100))}`;
      } else {
        text = `${memberName} is settled up`;
      }

      return `<div class="balance-item ${balanceClass}">${text}</div>`;
    }).join('');

    return `<div id="balances-summary" class="content">${balancesHtml}</div>`;
  },

  recalculateProjections: async function() {
    return new Promise(async (resolve, reject) => {
      const events = await db.events.orderBy('timestamp').toArray();
      const projections = {
        group_list: { projection_key: 'group_list', groups: {} },
      };

    const initializeGroupBalances = (group) => {
        const balances = {};
        group.members.forEach((_, index) => {
            balances[index] = { assets: 0, liabilities: 0, net: 0 };
        });
        return {
            projection_key: `group_balances_${group.id}`,
            balances: balances,
            expenses: []
        };
    };

    for (const event of events) {
        const groupId = event.aggregateId;

        if (event.eventType === 'GROUP_CREATED') {
            const group = {
                id: groupId,
                name: event.payload.name,
                members: event.payload.members
            };
            projections.group_list.groups[groupId] = group;
            projections[`group_balances_${groupId}`] = initializeGroupBalances(group);
        } else if (event.eventType === 'GROUP_DELETED') {
            delete projections.group_list.groups[groupId];
            delete projections[`group_balances_${groupId}`]; // Also delete balance projection
        } else if (event.eventType === 'EXPENSE_ADDED') {
            const balanceProjection = projections[`group_balances_${groupId}`];
            if (balanceProjection) {
                balanceProjection.expenses.push({
                    id: event.payload.expenseId,
                    description: event.payload.description,
                    amount: event.payload.amount,
                    payer_id: event.payload.payer,
                    beneficiaries: event.payload.beneficiaries,
                    timestamp: event.timestamp
                });

                for (const posting of event.payload.postings) {
                    const [accountType, _, memberIdStr] = posting.account.split(':');
                    const memberId = parseInt(memberIdStr, 10);

                    // Ignore non-member postings for balance calculation
                    if (isNaN(memberId)) {
                        continue;
                    }

                    // Ensure member balance object exists
                    if (!balanceProjection.balances[memberId]) {
                         balanceProjection.balances[memberId] = { assets: 0, liabilities: 0, net: 0 };
                    }

                    if (accountType === 'Assets') {
                        balanceProjection.balances[memberId].assets += posting.credit - posting.debit;
                    } else if (accountType === 'Liabilities') {
                        balanceProjection.balances[memberId].liabilities += posting.debit - posting.credit;
                    }
                }
            }
        } else if (event.eventType === 'EXPENSE_DELETED') {
            const balanceProjection = projections[`group_balances_${groupId}`];
            if (balanceProjection) {
                const expenseIdToDelete = event.payload.expenseId;
                const expenseEventToDelete = events.find(e => e.eventType === 'EXPENSE_ADDED' && e.payload.expenseId === expenseIdToDelete);

                if (expenseEventToDelete) {
                    // Reverse the postings
                    for (const posting of expenseEventToDelete.payload.postings) {
                        const [accountType, _, memberIdStr] = posting.account.split(':');
                        const memberId = parseInt(memberIdStr, 10);

                        if (isNaN(memberId)) continue;

                        if (accountType === 'Assets') {
                            balanceProjection.balances[memberId].assets -= (posting.credit - posting.debit);
                        } else if (accountType === 'Liabilities') {
                            balanceProjection.balances[memberId].liabilities -= (posting.debit - posting.credit);
                        }
                    }
                    // Mark expense as deleted
                    balanceProjection.expenses = balanceProjection.expenses.filter(e => e.id !== expenseIdToDelete);
                }
            }
        }
    }

    // Final pass to calculate net balances
    for (const key in projections) {
        if (key.startsWith('group_balances_')) {
            const balanceProjection = projections[key];
            for (const memberId in balanceProjection.balances) {
                const b = balanceProjection.balances[memberId];
                b.net = b.assets - b.liabilities;
            }
        }
    }

    try {
      // Atomically update all projections
      await db.transaction('rw', db.projections, async () => {
          await db.projections.clear();
          const allProjections = Object.values(projections);
          await db.projections.bulkPut(allProjections);
      });
      console.log('All projections recalculated.');
      resolve();
    } catch (error) {
      console.error('Projection recalculation failed:', error);
      reject(error);
    }
    });
  },

  renderGroupList: async function() {
    const projection = await db.projections.get('group_list');
    if (!projection || Object.keys(projection.groups).length === 0) {
      return '<div id="group-list"><p>No groups yet. Create one!</p></div>';
    }

    let cardsHtml = Object.values(projection.groups).map(group => `
      <div class="card mb-4">
        <header class="card-header">
          <p class="card-header-title">
            <a href="?route=group-detail&id=${group.id}" hx-get="?route=group-detail&id=${group.id}" hx-target="#app-content" hx-swap="innerHTML" hx-push-url="true">
              ${group.name}
            </a>
          </p>
          <button class="button is-danger is-small card-header-icon" hx-delete="/api/groups/${group.id}" hx-target="#app-content" hx-swap="innerHTML" hx-confirm="Are you sure you want to delete this group?">
            Delete
          </button>
        </header>
        <div class="card-content">
          <div class="content">
            <strong>Members:</strong>
            <ul>
              ${group.members.map(m => `<li>${m}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    `).join('');

    return `<div id="group-list">${cardsHtml}</div>`;
  },

  renderExpenseList: async function(groupId) {
    return renderExpenseList(db, groupId);
  },

  renderGroupDetail: async function(groupId) {
    const projection = await db.projections.get('group_list');
    const group = projection.groups[groupId];

    if (!group) {
      return '<p>Group not found.</p>';
    }

    const membersOptions = group.members.map((member, index) => `<option value="${index}">${member}</option>`).join('');
    const membersCheckboxes = group.members.map((member, index) => `
      <label class="checkbox">
        <input type="checkbox" name="beneficiaries" value="${index}" checked>
        ${member}
      </label>
    `).join('<br>');

    return `
      <div id="group-detail">
        <a href="?route=group-list" hx-get="?route=group-list" hx-target="#app-content" hx-swap="innerHTML" hx-push-url="true" class="is-link">← Back to Groups</a>
        <div class="is-flex is-justify-content-space-between is-align-items-center mt-4">
          <h2 class="title">${group.name}</h2>
          <button class="button is-primary" onclick="document.getElementById('add-expense-modal').classList.add('is-active')">
            Add Expense
          </button>
        </div>

        <div class="card mt-4">
          <header class="card-header">
            <p class="card-header-title">Balances</p>
          </header>
          <div class="card-content">
            <div id="balances-summary" class="content" hx-get="?route=group-balances&id=${groupId}" hx-trigger="load, expense-added from:body">
              <!-- Balances will be loaded here -->
              <p>Loading balances...</p>
            </div>
          </div>
        </div>

        <div class="card mt-4">
          <header class="card-header">
            <p class="card-header-title">Expenses</p>
          </header>
          <div class="card-content">
            <div id="expense-list" class="content" hx-get="?route=expense-list&id=${groupId}" hx-trigger="load, expense-added from:body">
              <p>Loading expenses...</p>
            </div>
          </div>
        </div>

        <div class="card mt-4">
          <header class="card-header">
            <p class="card-header-title">Members</p>
          </header>
          <div class="card-content">
            <div class="content">
              <ul>
                ${group.members.map(m => `<li>${m}</li>`).join('')}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div id="add-expense-modal" class="modal">
        <div class="modal-background" onclick="document.getElementById('add-expense-modal').classList.remove('is-active')"></div>
        <div class="modal-card">
          <header class="modal-card-head">
            <p class="modal-card-title">Add New Expense</p>
            <button class="delete" aria-label="close" onclick="document.getElementById('add-expense-modal').classList.remove('is-active')"></button>
          </header>
          <section class="modal-card-body">
            <form id="add-expense-form" hx-post="/api/groups/${groupId}/expenses" hx-target="#balances-summary" hx-swap="innerHTML" hx-on::after-request="this.closest('.modal').classList.remove('is-active'); this.reset()">
              <input type="hidden" name="split_strategy" value="equally">
              <div class="field">
                <label class="label">Description</label>
                <div class="control">
                  <input class="input" type="text" name="description" placeholder="e.g., Groceries" required>
                </div>
              </div>
              <div class="field">
                <label class="label">Amount (€)</label>
                <div class="control">
                  <input class="input" type="number" name="amount" placeholder="e.g., 25.50" step="0.01" min="0.01" required>
                </div>
              </div>
              <div class="field">
                <label class="label">Paid by</label>
                <div class="control">
                  <div class="select is-fullwidth">
                    <select name="payer">
                      ${membersOptions}
                    </select>
                  </div>
                </div>
              </div>
              <div class="field">
                <label class="label">Split expense</label>
                <div class="tabs is-boxed">
                  <ul>
                    <li class="is-active" data-tab="equally"><a>Equally</a></li>
                    <li data-tab="amount"><a>By Amount</a></li>
                    <li data-tab="percentage"><a>By Percentage</a></li>
                    <li data-tab="quote"><a>By Quote</a></li>
                  </ul>
                </div>
                <div id="split-tabs-content">
                  <div class="tab-content is-active" id="equally-content">
                    ${group.members.map((member, index) => `
                      <label class="checkbox">
                        <input type="checkbox" name="beneficiaries" value="${index}" checked>
                        ${member}
                      </label>
                    `).join('<br>')}
                  </div>
                  <div class="tab-content" id="amount-content" style="display: none;">
                    ${group.members.map((member, index) => `
                      <div>
                        <label>${member}</label>
                        <input class="input" type="number" name="amount_${index}" placeholder="0.00" step="0.01">
                      </div>
                    `).join('')}
                    <p>Total: <span id="amount-total">0.00</span></p>
                  </div>
                  <div class="tab-content" id="percentage-content" style="display: none;">
                    ${group.members.map((member, index) => `
                      <div>
                        <label>${member}</label>
                        <input class="input" type="number" name="percentage_${index}" placeholder="0" step="1">
                      </div>
                    `).join('')}
                    <p>Total: <span id="percentage-total">0</span>%</p>
                  </div>
                  <div class="tab-content" id="quote-content" style="display: none;">
                    ${group.members.map((member, index) => `
                      <div>
                        <label>${member}</label>
                        <input class="input" type="number" name="quote_${index}" placeholder="1" step="1">
                      </div>
                    `).join('')}
                    <p>Total shares: <span id="quote-total">0</span></p>
                  </div>
                </div>
              </div>

              <script>
                (function() {
                  const modal = document.getElementById('add-expense-modal');
                  const tabs = modal.querySelectorAll('.tabs li');
                  const tabContents = modal.querySelectorAll('.tab-content');
                  const amountTotalEl = modal.querySelector('#amount-total');
                  const percentageTotalEl = modal.querySelector('#percentage-total');
                  const quoteTotalEl = modal.querySelector('#quote-total');
                  const amountInput = modal.querySelector('input[name="amount"]');
                  const splitStrategyInput = modal.querySelector('input[name="split_strategy"]');

                  function updateTotal(selector, totalEl, suffix = '') {
                    let total = 0;
                    modal.querySelectorAll(selector).forEach(input => {
                      total += parseFloat(input.value) || 0;
                    });
                    totalEl.textContent = total.toFixed(2) + suffix;
                  }

                  tabs.forEach(tab => {
                    tab.addEventListener('click', () => {
                      tabs.forEach(t => t.classList.remove('is-active'));
                      tab.classList.add('is-active');

                      const target = tab.dataset.tab;
                      splitStrategyInput.value = target;
                      tabContents.forEach(content => {
                        content.style.display = content.id === target + '-content' ? 'block' : 'none';
                      });
                    });
                  });

                  modal.addEventListener('input', (event) => {
                    if (event.target.closest('#amount-content')) {
                      updateTotal('#amount-content input', amountTotalEl);
                    } else if (event.target.closest('#percentage-content')) {
                      updateTotal('#percentage-content input', percentageTotalEl, '%');
                    } else if (event.target.closest('#quote-content')) {
                      updateTotal('#quote-content input', quoteTotalEl, ' shares');
                    }
                  });

                  document.body.addEventListener('htmx:configRequest', function(event) {
                    if (event.detail.elt.id === 'add-expense-form') {
                      const strategy = splitStrategyInput.value;
                      const amount = parseFloat(amountInput.value) * 100;

                      if (strategy === 'amount') {
                        let total = 0;
                        modal.querySelectorAll('#amount-content input').forEach((input, index) => {
                          const value = parseFloat(input.value) * 100 || 0;
                          if (value > 0) {
                            event.detail.parameters['beneficiary_' + index + '_id'] = index;
                            event.detail.parameters['beneficiary_' + index + '_amount'] = value;
                            total += value;
                          }
                        });
                        if (total !== amount) {
                          alert('Total amount does not match the sum of individual amounts.');
                          event.preventDefault();
                        }
                      } else if (strategy === 'percentage') {
                        let total = 0;
                        modal.querySelectorAll('#percentage-content input').forEach((input, index) => {
                          const value = parseFloat(input.value) || 0;
                          if (value > 0) {
                            event.detail.parameters['beneficiary_' + index + '_id'] = index;
                            event.detail.parameters['beneficiary_' + index + '_amount'] = Math.round(amount * value / 100);
                            total += value;
                          }
                        });
                        if (total !== 100) {
                          alert('Percentages must add up to 100.');
                          event.preventDefault();
                        }
                      } else if (strategy === 'quote') {
                        let totalShares = 0;
                        modal.querySelectorAll('#quote-content input').forEach(input => {
                          totalShares += parseFloat(input.value) || 0;
                        });
                        if (totalShares > 0) {
                          modal.querySelectorAll('#quote-content input').forEach((input, index) => {
                            const value = parseFloat(input.value) || 0;
                            if (value > 0) {
                              event.detail.parameters['beneficiary_' + index + '_id'] = index;
                              event.detail.parameters['beneficiary_' + index + '_amount'] = Math.round(amount * value / totalShares);
                            }
                          });
                        }
                      }
                    }
                  });
                })();
              </script>
            </form>
          </section>
          <footer class="modal-card-foot">
            <button class="button is-success" onclick="document.getElementById('add-expense-form').dispatchEvent(new Event('submit', { bubbles: true }))">Save Expense</button>
            <button class="button" onclick="document.getElementById('add-expense-modal').classList.remove('is-active')">Cancel</button>
          </footer>
        </div>
      </div>
    `;
  }
};

const CACHE_NAME = 'cashsplitter-cache-v1';
const urlsToCache = [
  './',
  'index.html',
  'https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css',
  'https://unpkg.com/htmx.org@1.9.10',
  'https://unpkg.com/dexie@3.2.3/dist/dexie.js'
];

self.addEventListener('install', event => {
  console.log('[SW] Install event');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching assets');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
    event.respondWith(handleFetch(event));
});

async function handleFetch(event) {
    const url = new URL(event.request.url);

    if (event.request.mode === 'navigate') {
        return caches.match('index.html').then(response => {
            return response || fetch('index.html');
        });
    }

    if (url.pathname.startsWith('/api/')) {
        return handleActionRequest(event);
    }

    if (event.request.method === 'GET') {
        const isHtmxRequest = event.request.headers.get('HX-Request') === 'true';
        if (isHtmxRequest || url.searchParams.has('route')) {
            return handleFragmentRequest(event);
        } else {
            return caches.match(event.request).then(response => {
                return response || fetch(event.request);
            });
        }
    }

    return fetch(event.request);
}

async function handleFragmentRequest(event) {
    const url = new URL(event.request.url);
    const route = url.searchParams.get('route');

    try {
        if (route === 'group-list' || route === null) {
            await App.recalculateProjections();
            const fragment = await App.renderGroupList();
            return new Response(fragment, { headers: { 'Content-Type': 'text/html' } });
        }

        if (route === 'group-detail') {
            const groupId = url.searchParams.get('id');
            await App.recalculateProjections(); // Ensure data is fresh
            const fragment = await App.renderGroupDetail(groupId);
            return new Response(fragment, { headers: { 'Content-Type': 'text/html' } });
        }

        if (route === 'group-balances') {
            const groupId = url.searchParams.get('id');
            const fragment = await App.renderBalances(groupId);
            return new Response(fragment, { headers: { 'Content-Type': 'text/html' } });
        }

        if (route === 'expense-list') {
            const groupId = url.searchParams.get('id');
            const fragment = await App.renderExpenseList(groupId);
            return new Response(fragment, { headers: { 'Content-Type': 'text/html' } });
        }

        return new Response('Not Found', { status: 404 });
    } catch (error) {
        console.error(`Error rendering fragment for ${event.request.url}:`, error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

async function handleActionRequest(event) {
    const url = new URL(event.request.url);

    try {
        if (url.pathname.endsWith('/api/groups') && event.request.method === 'POST') {
            const formData = await event.request.formData();
            const groupName = formData.get('groupName');
            const groupMembers = formData.get('groupMembers');

            await App.saveGroupCreatedEvent(groupName, groupMembers);
            await App.recalculateProjections();
            const fragment = await App.renderGroupList();
            return new Response(fragment, { headers: { 'Content-Type': 'text/html' } });
        }

        const groupDeleteMatch = url.pathname.match(/\/api\/groups\/(?!.*\/expenses)(.*)/);
        if (groupDeleteMatch && event.request.method === 'DELETE') {
            const groupId = groupDeleteMatch[1];
            await App.saveGroupDeletedEvent(groupId);
            await App.recalculateProjections();
            const fragment = await App.renderGroupList();
            return new Response(fragment, { headers: { 'Content-Type': 'text/html' }});
        }

        const expenseDeleteMatch = url.pathname.match(/\/api\/groups\/(.*)\/expenses\/(.*)/);
        if (expenseDeleteMatch && event.request.method === 'DELETE') {
            const [, groupId, expenseId] = expenseDeleteMatch;
            await App.saveExpenseDeletedEvent(groupId, expenseId);
            await App.recalculateProjections();
            return new Response(null, { status: 204, headers: { 'HX-Trigger': 'expense-added' } }); // Re-use trigger
        }

        const expenseAddMatch = url.pathname.match(/\/api\/groups\/(.*)\/expenses/);
        if (expenseAddMatch && event.request.method === 'POST') {
          const groupId = expenseAddMatch[1];
          const formData = await event.request.formData();
          const description = formData.get('description');
          const amount = parseFloat(formData.get('amount'));
          const amountCents = Math.round(amount * 100);
          const payerId = parseInt(formData.get('payer'), 10);
          const splitStrategy = formData.get('split_strategy');

          let beneficiaries = [];

          if (splitStrategy === 'equally') {
            const beneficiaryIds = formData.getAll('beneficiaries').map(id => parseInt(id, 10));
            const numBeneficiaries = beneficiaryIds.length;
            if (numBeneficiaries > 0) {
                const share = Math.floor(amountCents / numBeneficiaries);
                let remainder = amountCents % numBeneficiaries;
                beneficiaries = beneficiaryIds.map(id => ({ id, amount: share }));
                for (let i = 0; i < remainder; i++) {
                    beneficiaries[beneficiaries.length - 1 - i].amount++;
                }
            }
          } else {
            const beneficiaryData = {};
            for (const [key, value] of formData.entries()) {
              const match = key.match(/beneficiary_(\d+)_(\w+)/);
              if (match) {
                const id = match[1];
                const field = match[2];
                if (!beneficiaryData[id]) {
                  beneficiaryData[id] = {};
                }
                beneficiaryData[id][field] = value;
              }
            }
            beneficiaries = Object.values(beneficiaryData).map(b => ({ id: parseInt(b.id), amount: parseInt(b.amount) }));
          }

          await App.saveExpenseAddedEvent(groupId, description, amountCents, payerId, beneficiaries);
          await App.recalculateProjections();

          return new Response(null, { status: 204, headers: { 'HX-Trigger': 'expense-added' } });
        }

        return new Response('Not Found', { status: 404 });
    } catch (error) {
        console.error(`Error handling action ${event.request.method} ${event.request.url}:`, error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
