
import re
from playwright.sync_api import Page, expect

BASE_URL = "http://localhost:8000"

def wait_for_app_ready(page: Page):
    """
    Navigates to the page and waits for the service worker to activate
    and for the initial htmx content to load by waiting for the API response.
    """
    page.goto(BASE_URL)
    # The page may reload on first load to activate the service worker.
    # page.goto handles this. After the page is stable, htmx will
    # trigger a request to load the initial group list.
    # We wait for that response to ensure the app is ready.
    with page.expect_response(lambda res: "?route=group-list" in res.url) as response:
        pass # The action that triggers the request has already happened.

def test_create_group(page: Page):
    wait_for_app_ready(page)
    page.get_by_role("button", name="+").last.click()
    modal = page.locator("#new-group-modal.is-active").last
    expect(modal).to_be_visible()
    modal.get_by_placeholder("e.g., Holiday Trip").fill("Test Group")
    modal.get_by_placeholder("Comma-separated names").fill("Alice, Bob")
    modal.get_by_role("button", name="Save changes").click()
    expect(page.get_by_role("link", name="Test Group")).to_be_visible()

def test_see_details(page: Page):
    wait_for_app_ready(page)
    page.get_by_role("button", name="+").last.click()
    modal = page.locator("#new-group-modal.is-active").last
    expect(modal).to_be_visible()
    modal.get_by_placeholder("e.g., Holiday Trip").fill("Details Test")
    modal.get_by_placeholder("Comma-separated names").fill("Charlie, David")
    modal.get_by_role("button", name="Save changes").click()
    page.get_by_role("link", name="Details Test").click()
    expect(page.locator(".card-header-title", has_text="Balances")).to_be_visible()
    expect(page.get_by_role("button", name="Add Expense")).to_be_visible()
    expect(page.locator("#group-detail .content ul").get_by_text("Charlie")).to_be_visible()
    expect(page.locator("#group-detail .content ul").get_by_text("David")).to_be_visible()

def test_delete_group(page: Page):
    wait_for_app_ready(page)
    page.get_by_role("button", name="+").last.click()
    modal = page.locator("#new-group-modal.is-active").last
    expect(modal).to_be_visible()
    modal.get_by_placeholder("e.g., Holiday Trip").fill("To Delete")
    modal.get_by_placeholder("Comma-separated names").fill("Eve")
    modal.get_by_role("button", name="Save changes").click()

    card_locator = page.locator(".card", has_text="To Delete")
    delete_button_locator = card_locator.get_by_role("button", name="Delete")

    expect(delete_button_locator).to_be_visible()
    page.once("dialog", lambda dialog: dialog.accept())
    delete_button_locator.click()
    expect(page.get_by_text("To Delete")).not_to_be_visible()

def test_add_expense(page: Page):
    wait_for_app_ready(page)

    # 1. Create a group
    page.get_by_role("button", name="+").last.click()
    modal = page.locator("#new-group-modal.is-active").last
    expect(modal).to_be_visible()
    modal.get_by_placeholder("e.g., Holiday Trip").fill("Expense Test")
    modal.get_by_placeholder("Comma-separated names").fill("Alice, Bob, Charlie")
    modal.get_by_role("button", name="Save changes").click()

    # 2. Navigate to group detail and add expense
    page.get_by_role("link", name="Expense Test").click()
    page.get_by_role("button", name="Add Expense").click()

    expense_modal = page.locator("#add-expense-modal.is-active").last
    expect(expense_modal).to_be_visible()
    expense_modal.get_by_placeholder("e.g., 25.50").fill("10")
    expense_modal.locator('select[name="payer"]').select_option(label="Alice")
    # Uncheck Charlie to test unequal splits
    expense_modal.get_by_label("Charlie").uncheck()
    expense_modal.get_by_role("button", name="Save Expense").click()

    # 3. Verify balances
    balances_summary = page.locator("#balances-summary").last
    expect(balances_summary.get_by_text("Alice is owed")).to_be_visible()
    expect(balances_summary.get_by_text("Bob owes")).to_be_visible()
    expect(balances_summary.get_by_text("Charlie is settled up")).to_be_visible()
    # This is the crucial assertion to check for the bug
    expect(balances_summary.get_by_text("undefined")).not_to_be_visible()
