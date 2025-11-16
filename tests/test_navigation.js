const { test, expect } = require('@playwright/test');

const BASE_URL = "http://localhost:8000";

async function waitForAppReady(page) {
  await page.goto(BASE_URL);
  await page.locator('body[data-app-ready="true"]').waitFor({ timeout: 10000 });
}

test('title link navigates home', async ({ page }) => {
  await waitForAppReady(page);

  // 1. Create a group to navigate away from the home page
  await page.getByRole('button', { name: '+' }).last().click();
  const modal = page.locator('#new-group-modal.is-active').last();
  await modal.getByPlaceholder('e.g., Holiday Trip').fill('Nav Test Group');
  await modal.getByPlaceholder('Comma-separated names').fill('Alice');
  await modal.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('link', { name: 'Nav Test Group' })).toBeVisible();

  // 2. Go to the group's detail page
  await page.getByRole('link', { name: 'Nav Test Group' }).click();
  await expect(page.locator('h2.title', { hasText: 'Nav Test Group' })).toBeVisible();
  await expect(page.getByText('No groups yet.')).not.toBeVisible();

  // 3. Click the main title
  await page.getByRole('heading', { name: 'CashSplitter' }).click();

  // 4. Verify we are back on the group list page
  await expect(page.getByRole('link', { name: 'Nav Test Group' })).toBeVisible();
  await expect(page.locator('h2.title', { hasText: 'Nav Test Group' })).not.toBeVisible();
});
