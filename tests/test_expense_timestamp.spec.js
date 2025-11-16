
const { test, expect } = require('@playwright/test');

const BASE_URL = "http://localhost:8000";

async function waitForAppReady(page) {
  await page.goto(BASE_URL);
  await page.locator('body[data-app-ready="true"]').waitFor({ timeout: 10000 });
}

test('view expense timestamp', async ({ page }) => {
  await waitForAppReady(page);

  // 1. Create a group
  await page.getByRole('button', { name: '+' }).last().click();
  const modal = page.locator('#new-group-modal.is-active').last();
  await modal.getByPlaceholder('e.g., Holiday Trip').fill('Timestamp Test');
  await modal.getByPlaceholder('Comma-separated names').fill('Alice, Bob');
  await modal.getByRole('button', { name: 'Save changes' }).click();

  // 2. Go to group details and add an expense
  await page.getByRole('link', { name: 'Timestamp Test' }).click();
  await page.getByRole('button', { name: 'Add Expense' }).click();
  const expenseModal = page.locator('#add-expense-modal.is-active').last();
  await expenseModal.getByPlaceholder('e.g., Groceries').fill('Lunch');
  await expenseModal.getByPlaceholder('e.g., 25.50').fill('20');
  await expenseModal.locator('select[name="payer"]').selectOption({ label: 'Alice' });
  await expenseModal.getByRole('button', { name: 'Save Expense' }).click();

  // 3. Verify the expense is listed
  const expenseList = page.locator('#expense-list');
  const expenseBox = expenseList.locator('.box', { hasText: 'Lunch' });
  await expect(expenseBox).toBeVisible();
  await expect(expenseBox.getByText('Amount: 20,00 €')).toBeVisible();
  await expect(expenseBox.getByText('Paid by: Alice')).toBeVisible();

  // 4. Verify the timestamp is visible
  await expect(expenseBox.getByText('Added on:')).toBeVisible();
});
