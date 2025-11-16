
from playwright.sync_api import Page, expect

BASE_URL = "http://localhost:8000"

def wait_for_app_ready(page: Page):
    """
    Navigates to the base URL and waits for the app to signal it's ready.
    """
    page.goto(BASE_URL)
    page.locator('body[data-app-ready="true"]').wait_for(timeout=10000)

def test_split_by_amount(page: Page):
    wait_for_app_ready(page)

    # 1. Create a group
    page.get_by_role("button", name="+").last.click()
    modal = page.locator("#new-group-modal.is-active").last
    modal.get_by_placeholder("e.g., Holiday Trip").fill("Amount Split Test")
    modal.get_by_placeholder("Comma-separated names").fill("Alice, Bob, Charlie")
    modal.get_by_role("button", name="Save changes").click()

    # 2. Go to group details and add an expense
    page.get_by_role("link", name="Amount Split Test").click()
    page.get_by_role("button", name="Add Expense").click()
    expense_modal = page.locator("#add-expense-modal.is-active").last
    expense_modal.get_by_placeholder("e.g., Groceries").fill("Dinner")
    expense_modal.get_by_placeholder("e.g., 25.50").fill("100")
    expense_modal.locator('select[name="payer"]').select_option(label="Alice")

    # 3. Split by amount
    expense_modal.locator('[data-tab="amount"]').click()
    expense_modal.locator('input[name="amount_0"]').fill("20")
    expense_modal.locator('input[name="amount_1"]').fill("30")
    expense_modal.locator('input[name="amount_2"]').fill("50")
    expense_modal.get_by_role("button", name="Save Expense").click()

    # 4. Verify the balances
    balances = page.locator("#balances-summary")
    expect(balances.get_by_text("Alice is owed 80,00 €")).to_be_visible()
    expect(balances.get_by_text("Bob owes 30,00 €")).to_be_visible()
    expect(balances.get_by_text("Charlie owes 50,00 €")).to_be_visible()

def test_split_by_percentage(page: Page):
    wait_for_app_ready(page)

    # 1. Create a group
    page.get_by_role("button", name="+").last.click()
    modal = page.locator("#new-group-modal.is-active").last
    modal.get_by_placeholder("e.g., Holiday Trip").fill("Percentage Split Test")
    modal.get_by_placeholder("Comma-separated names").fill("Alice, Bob, Charlie")
    modal.get_by_role("button", name="Save changes").click()

    # 2. Go to group details and add an expense
    page.get_by_role("link", name="Percentage Split Test").click()
    page.get_by_role("button", name="Add Expense").click()
    expense_modal = page.locator("#add-expense-modal.is-active").last
    expense_modal.get_by_placeholder("e.g., Groceries").fill("Snacks")
    expense_modal.get_by_placeholder("e.g., 25.50").fill("100")
    expense_modal.locator('select[name="payer"]').select_option(label="Alice")

    # 3. Split by percentage
    expense_modal.locator('[data-tab="percentage"]').click()
    expense_modal.locator('input[name="percentage_0"]').fill("10")
    expense_modal.locator('input[name="percentage_1"]').fill("20")
    expense_modal.locator('input[name="percentage_2"]').fill("70")
    expense_modal.get_by_role("button", name="Save Expense").click()

    # 4. Verify the balances
    balances = page.locator("#balances-summary")
    expect(balances.get_by_text("Alice is owed 90,00 €")).to_be_visible()
    expect(balances.get_by_text("Bob owes 20,00 €")).to_be_visible()
    expect(balances.get_by_text("Charlie owes 70,00 €")).to_be_visible()

def test_split_by_quote(page: Page):
    wait_for_app_ready(page)

    # 1. Create a group
    page.get_by_role("button", name="+").last.click()
    modal = page.locator("#new-group-modal.is-active").last
    modal.get_by_placeholder("e.g., Holiday Trip").fill("Quote Split Test")
    modal.get_by_placeholder("Comma-separated names").fill("Alice, Bob, Charlie")
    modal.get_by_role("button", name="Save changes").click()

    # 2. Go to group details and add an expense
    page.get_by_role("link", name="Quote Split Test").click()
    page.get_by_role("button", name="Add Expense").click()
    expense_modal = page.locator("#add-expense-modal.is-active").last
    expense_modal.get_by_placeholder("e.g., Groceries").fill("Tickets")
    expense_modal.get_by_placeholder("e.g., 25.50").fill("100")
    expense_modal.locator('select[name="payer"]').select_option(label="Alice")

    # 3. Split by quote
    expense_modal.locator('[data-tab="quote"]').click()
    expense_modal.locator('input[name="quote_0"]').fill("1")
    expense_modal.locator('input[name="quote_1"]').fill("2")
    expense_modal.locator('input[name="quote_2"]').fill("1")
    expense_modal.get_by_role("button", name="Save Expense").click()

    # 4. Verify the balances
    balances = page.locator("#balances-summary")
    expect(balances.get_by_text("Alice is owed 75,00 €")).to_be_visible()
    expect(balances.get_by_text("Bob owes 50,00 €")).to_be_visible()
    expect(balances.get_by_text("Charlie owes 25,00 €")).to_be_visible()

def test_remainder_distribution(page: Page):
    wait_for_app_ready(page)

    # 1. Create a group
    page.get_by_role("button", name="+").last.click()
    modal = page.locator("#new-group-modal.is-active").last
    modal.get_by_placeholder("e.g., Holiday Trip").fill("Remainder Test")
    modal.get_by_placeholder("Comma-separated names").fill("Alice, Bob, Charlie")
    modal.get_by_role("button", name="Save changes").click()

    # 2. Go to group details and add an expense
    page.get_by_role("link", name="Remainder Test").click()
    page.get_by_role("button", name="Add Expense").click()
    expense_modal = page.locator("#add-expense-modal.is-active").last
    expense_modal.get_by_placeholder("e.g., Groceries").fill("Coffee")
    expense_modal.get_by_placeholder("e.g., 25.50").fill("10")
    expense_modal.locator('select[name="payer"]').select_option(label="Alice")

    # 3. Split equally
    expense_modal.get_by_role("button", name="Save Expense").click()

    # 4. Verify the balances
    balances = page.locator("#balances-summary")
    expect(balances.get_by_text("Alice is owed 6,67 €")).to_be_visible()
    expect(balances.get_by_text("Bob owes 3,33 €")).to_be_visible()
    expect(balances.get_by_text("Charlie owes 3,34 €")).to_be_visible()
