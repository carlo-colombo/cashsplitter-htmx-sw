const { test, expect } = require('@playwright/test');

const BASE_URL = "http://localhost:8000";

async function waitForAppReady(page) {
  await page.goto(BASE_URL);
  await page.locator('body[data-app-ready="true"]').waitFor({ timeout: 10000 });
}

test('split by amount', async ({ page }) => {
  await waitForAppReady(page);

  // 1. Create a group
  await page.getByRole('button', { name: '+' }).last().click();
  const modal = page.locator('#new-group-modal.is-active').last();
  await modal.getByPlaceholder('e.g., Holiday Trip').fill('Amount Split Test');
  await modal.getByPlaceholder('Comma-separated names').fill('Alice, Bob, Charlie');
  await modal.getByRole('button', { name: 'Save changes' }).click();

  // 2. Go to group details and add an expense
  await page.getByRole('link', { name: 'Amount Split Test' }).click();
  await page.getByRole('button', { name: 'Add Expense' }).click();
  const expenseModal = page.locator('#add-expense-modal.is-active').last();
  await expenseModal.getByPlaceholder('e.g., Groceries').fill('Dinner');
  await expenseModal.getByPlaceholder('e.g., 25.50').fill('100');
  await expenseModal.locator('select[name="payer"]').selectOption({ label: 'Alice' });

  // 3. Split by amount
  await expenseModal.locator('[data-tab="amount"]').click();
  await expenseModal.locator('input[name="amount_0"]').fill('20');
  await expenseModal.locator('input[name="amount_1"]').fill('30');
  await expenseModal.locator('input[name="amount_2"]').fill('50');
  await expenseModal.getByRole('button', { name: 'Save Expense' }).click();

  // 4. Verify the balances
  const balances = page.locator('#balances-summary');
  await expect(balances.getByText('Alice is owed 80,00 €')).toBeVisible();
  await expect(balances.getByText('Bob owes 30,00 €')).toBeVisible();
  await expect(balances.getByText('Charlie owes 50,00 €')).toBeVisible();
});

test('split by percentage', async ({ page }) => {
  await waitForAppReady(page);

  // 1. Create a group
  await page.getByRole('button', { name: '+' }).last().click();
  const modal = page.locator('#new-group-modal.is-active').last();
  await modal.getByPlaceholder('e.g., Holiday Trip').fill('Percentage Split Test');
  await modal.getByPlaceholder('Comma-separated names').fill('Alice, Bob, Charlie');
  await modal.getByRole('button', { name: 'Save changes' }).click();

  // 2. Go to group details and add an expense
  await page.getByRole('link', { name: 'Percentage Split Test' }).click();
  await page.getByRole('button', { name: 'Add Expense' }).click();
  const expenseModal = page.locator('#add-expense-modal.is-active').last();
  await expenseModal.getByPlaceholder('e.g., Groceries').fill('Snacks');
  await expenseModal.getByPlaceholder('e.g., 25.50').fill('100');
  await expenseModal.locator('select[name="payer"]').selectOption({ label: 'Alice' });

  // 3. Split by percentage
  await expenseModal.locator('[data-tab="percentage"]').click();
  await expenseModal.locator('input[name="percentage_0"]').fill('10');
  await expenseModal.locator('input[name="percentage_1"]').fill('20');
  await expenseModal.locator('input[name="percentage_2"]').fill('70');
  await expenseModal.getByRole('button', { name: 'Save Expense' }).click();

  // 4. Verify the balances
  const balances = page.locator('#balances-summary');
  await expect(balances.getByText('Alice is owed 90,00 €')).toBeVisible();
  await expect(balances.getByText('Bob owes 20,00 €')).toBeVisible();
  await expect(balances.getByText('Charlie owes 70,00 €')).toBeVisible();
});

test('split by quote', async ({ page }) => {
  await waitForAppReady(page);

  // 1. Create a group
  await page.getByRole('button', { name: '+' }).last().click();
  const modal = page.locator('#new-group-modal.is-active').last();
  await modal.getByPlaceholder('e.g., Holiday Trip').fill('Quote Split Test');
  await modal.getByPlaceholder('Comma-separated names').fill('Alice, Bob, Charlie');
  await modal.getByRole('button', { name: 'Save changes' }).click();

  // 2. Go to group details and add an expense
  await page.getByRole('link', { name: 'Quote Split Test' }).click();
  await page.getByRole('button', { name: 'Add Expense' }).click();
  const expenseModal = page.locator('#add-expense-modal.is-active').last();
  await expenseModal.getByPlaceholder('e.g., Groceries').fill('Tickets');
  await expenseModal.getByPlaceholder('e.g., 25.50').fill('100');
  await expenseModal.locator('select[name="payer"]').selectOption({ label: 'Alice' });

  // 3. Split by quote
  await expenseModal.locator('[data-tab="quote"]').click();
  await expenseModal.locator('input[name="quote_0"]').fill('1');
  await expenseModal.locator('input[name="quote_1"]').fill('2');
  await expenseModal.locator('input[name="quote_2"]').fill('1');
  await expenseModal.getByRole('button', { name: 'Save Expense' }).click();

  // 4. Verify the balances
  const balances = page.locator('#balances-summary');
  await expect(balances.getByText('Alice is owed 75,00 €')).toBeVisible();
  await expect(balances.getByText('Bob owes 50,00 €')).toBeVisible();
  await expect(balances.getByText('Charlie owes 25,00 €')).toBeVisible();
});

test('remainder distribution', async ({ page }) => {
  await waitForAppReady(page);

  // 1. Create a group
  await page.getByRole('button', { name: '+' }).last().click();
  const modal = page.locator('#new-group-modal.is-active').last();
  await modal.getByPlaceholder('e.g., Holiday Trip').fill('Remainder Test');
  await modal.getByPlaceholder('Comma-separated names').fill('Alice, Bob, Charlie');
  await modal.getByRole('button', { name: 'Save changes' }).click();

  // 2. Go to group details and add an expense
  await page.getByRole('link', { name: 'Remainder Test' }).click();
  await page.getByRole('button', { name: 'Add Expense' }).click();
  const expenseModal = page.locator('#add-expense-modal.is-active').last();
  await expenseModal.getByPlaceholder('e.g., Groceries').fill('Coffee');
  await expenseModal.getByPlaceholder('e.g., 25.50').fill('10');
  await expenseModal.locator('select[name="payer"]').selectOption({ label: 'Alice' });

  // 3. Split equally
  await expenseModal.getByRole('button', { name: 'Save Expense' }).click();

  // 4. Verify the balances
  const balances = page.locator('#balances-summary');
  await expect(balances.getByText('Alice is owed 6,67 €')).toBeVisible();
  await expect(balances.getByText('Bob owes 3,33 €')).toBeVisible();
  await expect(balances.getByText('Charlie owes 3,34 €')).toBeVisible();
});
