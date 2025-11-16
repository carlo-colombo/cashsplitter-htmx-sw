const { test, expect } = require('@playwright/test');

const BASE_URL = "http://localhost:8000";

async function waitForAppReady(page) {
  await page.goto(BASE_URL);
  await page.locator('body[data-app-ready="true"]').waitFor({ timeout: 10000 });
}

test('add and delete expense', async ({ page }) => {
  await waitForAppReady(page);

  // 1. Create a group
  await page.getByRole('button', { name: '+' }).last().click();
  const modal = page.locator('#new-group-modal.is-active').last();
  await modal.getByPlaceholder('e.g., Holiday Trip').fill('Expense Test');
  await modal.getByPlaceholder('Comma-separated names').fill('Frank, Grace');
  await modal.getByRole('button', { name: 'Save changes' }).click();

  // 2. Go to group details and add an expense
  await page.getByRole('link', { name: 'Expense Test' }).click();
  await page.getByRole('button', { name: 'Add Expense' }).click();
  const expenseModal = page.locator('#add-expense-modal.is-active').last();
  await expenseModal.getByPlaceholder('e.g., Groceries').fill('Dinner');
  await expenseModal.getByPlaceholder('e.g., 25.50').fill('50');
  await expenseModal.locator('select[name="payer"]').selectOption({ label: 'Frank' });
  await expenseModal.getByRole('button', { name: 'Save Expense' }).click();

  // 3. Verify the balances
  const balances = page.locator('#balances-summary');
  await expect(balances.getByText('Frank is owed 25,00 €')).toBeVisible();
  await expect(balances.getByText('Grace owes 25,00 €')).toBeVisible();

  // 4. Verify the expense is listed
  const expenseList = page.locator('#expense-list');
  const expenseBox = expenseList.locator('.box', { hasText: 'Dinner' });
  await expect(expenseBox).toBeVisible();
  await expect(expenseBox.getByText('Amount: 50,00 €')).toBeVisible();
  await expect(expenseBox.getByText('Paid by: Frank')).toBeVisible();

  // 5. Delete the expense
  const deleteButton = expenseBox.getByRole('button', { name: 'Delete' });
  page.on('dialog', dialog => dialog.accept());
  await deleteButton.click();

  // 6. Verify the expense is gone
  await expect(page.getByText('No expenses recorded yet.')).toBeVisible();

  // 7. Verify balances are reset
  await expect(balances.getByText('Frank is settled up')).toBeVisible();
  await expect(balances.getByText('Grace is settled up')).toBeVisible();
});
