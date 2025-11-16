
import re
from playwright.sync_api import Page, expect

BASE_URL = "http://localhost:8000"

def wait_for_app_ready(page: Page):
    """
    Navigates to the base URL and waits for the app to signal it's ready.
    """
    page.goto(BASE_URL)
    page.locator('body[data-app-ready="true"]').wait_for(timeout=10000)

def test_add_and_delete_expense(page: Page):
    wait_for_app_ready(page)

    # 1. Create a group
    page.get_by_role("button", name="+").last.click()
    modal = page.locator("#new-group-modal.is-active").last
    modal.get_by_placeholder("e.g., Holiday Trip").fill("Expense Test")
    modal.get_by_placeholder("Comma-separated names").fill("Frank, Grace")
    modal.get_by_role("button", name="Save changes").click()

    # 2. Go to group details and add an expense
    page.get_by_role("link", name="Expense Test").click()
    page.get_by_role("button", name="Add Expense").click()
    expense_modal = page.locator("#add-expense-modal.is-active").last
    expense_modal.get_by_placeholder("e.g., Groceries").fill("Dinner")
    expense_modal.get_by_placeholder("e.g., 25.50").fill("50")
    expense_modal.locator('select[name="payer"]').select_option(label="Frank")
    expense_modal.get_by_role("button", name="Save Expense").click()

    # 3. Verify the balances
    balances = page.locator("#balances-summary")
    expect(balances.get_by_text("Frank is owed 25,00 €")).to_be_visible()
    expect(balances.get_by_text("Grace owes 25,00 €")).to_be_visible()

    # 4. Verify the expense is listed
    expense_list = page.locator("#expense-list")
    expense_box = expense_list.locator(".box", has_text="Dinner")
    expect(expense_box).to_be_visible()
    expect(expense_box.get_by_text("Amount: 50,00 €")).to_be_visible()
    expect(expense_box.get_by_text("Paid by: Frank")).to_be_visible()

    # 5. Delete the expense
    delete_button = expense_box.get_by_role("button", name="Delete")
    page.once("dialog", lambda dialog: dialog.accept())
    delete_button.click()

    # 6. Verify the expense is gone
    # After deletion, the entire list is re-rendered. We expect the placeholder.
    expect(page.get_by_text("No expenses recorded yet.")).to_be_visible()

    # 7. Verify balances are reset
    expect(balances.get_by_text("Frank is settled up")).to_be_visible()
    expect(balances.get_by_text("Grace is settled up")).to_be_visible()
