const { test, expect } = require('@playwright/test');

const BASE_URL = "http://localhost:8000";

async function waitForAppReady(page) {
  await page.goto(BASE_URL);
  await page.locator('body[data-app-ready="true"]').waitFor({ timeout: 10000 });
}

test('create group', async ({ page }) => {
  await waitForAppReady(page);
  await page.getByRole('button', { name: '+' }).last().click();
  const modal = page.locator('#new-group-modal.is-active').last();
  await expect(modal).toBeVisible();
  await modal.getByPlaceholder('e.g., Holiday Trip').fill('Test Group');
  await modal.getByPlaceholder('Comma-separated names').fill('Alice, Bob');
  await modal.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('link', { name: 'Test Group' })).toBeVisible();
});

test('see details', async ({ page }) => {
  await waitForAppReady(page);
  await page.getByRole('button', { name: '+' }).last().click();
  const modal = page.locator('#new-group-modal.is-active').last();
  await expect(modal).toBeVisible();
  await modal.getByPlaceholder('e.g., Holiday Trip').fill('Details Test');
  await modal.getByPlaceholder('Comma-separated names').fill('Charlie, David');
  await modal.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('link', { name: 'Details Test' }).click();
  await expect(page.locator('.card-header-title', { hasText: 'Balances' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Expense' })).toBeVisible();
  await expect(page.locator('#group-detail .content ul').getByText('Charlie')).toBeVisible();
  await expect(page.locator('#group-detail .content ul').getByText('David')).toBeVisible();
});

test('delete group', async ({ page }) => {
  await waitForAppReady(page);
  await page.getByRole('button', { name: '+' }).last().click();
  const modal = page.locator('#new-group-modal.is-active').last();
  await expect(modal).toBeVisible();
  await modal.getByPlaceholder('e.g., Holiday Trip').fill('To Delete');
  await modal.getByPlaceholder('Comma-separated names').fill('Eve');
  await modal.getByRole('button', { name: 'Save changes' }).click();

  const cardLocator = page.locator('.card', { hasText: 'To Delete' });
  const deleteButtonLocator = cardLocator.getByRole('button', { name: 'Delete' });

  await expect(deleteButtonLocator).toBeVisible();
  page.on('dialog', dialog => dialog.accept());
  await deleteButtonLocator.click();
  await expect(page.getByText('To Delete')).not.toBeVisible();
});
