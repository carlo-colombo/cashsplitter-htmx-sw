const { test, expect } = require('@playwright/test');

const BASE_URL = "http://localhost:8000";

async function waitForAppReady(page) {
  await page.goto(BASE_URL);
  await page.locator('body[data-app-ready="true"]').waitFor({ timeout: 10000 });
}

test('view expense details', async ({ page }) => {
  await waitForAppReady(page);

  // 1. Create a group
  await page.getByRole('button', { name: '+' }).last().click();
  const modal = page.locator('#new-group-modal.is-active').last();
  await modal.getByPlaceholder('e.g., Holiday Trip').fill('Expense Details Test');
  await modal.getByPlaceholder('Comma-separated names').fill('Frank, Grace, Helen');
  await modal.getByRole('button', { name: 'Save changes' }).click();

  // 2. Go to group details and add an expense
  await page.getByRole('link', { name: 'Expense Details Test' }).click();
  await page.getByRole('button', { name: 'Add Expense' }).click();
  const expenseModal = page.locator('#add-expense-modal.is-active').last();
  await expenseModal.getByPlaceholder('e.g., Groceries').fill('Dinner');
  await expenseModal.getByPlaceholder('e.g., 25.50').fill('60');
  await expenseModal.locator('select[name="payer"]').selectOption({ label: 'Frank' });
  await expenseModal.getByRole('button', { name: 'Save Expense' }).click();

  // 3. Verify the expense is listed
  const expenseList = page.locator('#expense-list');
  const expenseBox = expenseList.locator('.box', { hasText: 'Dinner' });
  await expect(expenseBox).toBeVisible();
  await expect(expenseBox.getByText('Amount: 60,00 €')).toBeVisible();
  await expect(expenseBox.getByText('Paid by: Frank')).toBeVisible();

  // 4. Verify the expense details
  await expect(expenseBox.getByText('Frank is owed 40,00 €')).toBeVisible();
  await expect(expenseBox.getByText('Grace owes 20,00 €')).toBeVisible();
  await expect(expenseBox.getByText('Helen owes 20,00 €')).toBeVisible();
});
