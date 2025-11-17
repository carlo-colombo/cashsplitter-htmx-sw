export async function renderExpenseList(db, groupId) {
    const groupListProjection = await db.projections.get('group_list');
    const group = groupListProjection.groups[groupId];
    const balanceProjection = await db.projections.get(`group_balances_${groupId}`);

    if (!balanceProjection || !balanceProjection.expenses || balanceProjection.expenses.length === 0) {
      return '<p>No expenses recorded yet.</p>';
    }

    const formatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

    let expensesHtml = balanceProjection.expenses.map(expense => {
      const payerName = group.members[expense.payer_id];
      const formattedAmount = formatter.format(expense.amount / 100);

      const expenseDetails = expense.beneficiaries.map(beneficiary => {
        const memberName = group.members[beneficiary.id];
        const formattedAmount = formatter.format(beneficiary.amount / 100);

        if (beneficiary.id === expense.payer_id) {
          const isOwed = expense.amount - beneficiary.amount;
          return `<p class="has-text-success">${memberName} is owed ${formatter.format(isOwed / 100)}</p>`;
        }

        return `<p class="has-text-danger">${memberName} owes ${formattedAmount}</p>`;
      }).join('');

      const formattedTimestamp = new Date(expense.timestamp).toLocaleString();

      return `
        <div class="box">
          <div class="is-flex is-justify-content-space-between">
            <div>
              <p><strong>${expense.description}</strong></p>
              <p>Amount: ${formattedAmount}</p>
              <p>Paid by: ${payerName}</p>
              <p><small>Added on: ${formattedTimestamp}</small></p>
              <div class="content mt-2">${expenseDetails}</div>
            </div>
            <button class="button is-danger is-small"
                    hx-delete="/api/groups/${groupId}/expenses/${expense.id}"
                    hx-confirm="Are you sure you want to delete this expense?"
                    hx-target="#expense-list"
                    hx-swap="outerHTML">
              Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

    return `<div id="expense-list">${expensesHtml}</div>`;
  }