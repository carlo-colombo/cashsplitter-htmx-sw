
import re
import time
from playwright.sync_api import Page, expect

BASE_URL = "http://localhost:8000"

def wait_for_app_ready(page: Page):
    """
    Navigates to the page and waits for the service worker to activate
    and for the initial htmx content to load. This is more complex
    than usual due to the service worker's activation logic, which
    can cause a page reload.
    """
    page.goto(BASE_URL)

    # Wait for the service worker to become active.
    # This might involve a page reload, which page.goto() handles.
    # We poll for the service worker controller to be available.
    page.wait_for_function("navigator.serviceWorker.controller !== null")

    # Once the service worker is active, the page will request the
    # initial content via htmx. We wait for this response to ensure
    # the app is fully loaded.
    with page.expect_response(lambda res: "?route=group-list" in res.url):
        # The htmx request might have already been triggered by the time
        # we start waiting, so we need to ensure the page is fully loaded
        # before continuing. A simple way to do this is to reload if the
        # response is not received within a short timeout.
        try:
            page.wait_for_event("response", timeout=2000)
        except Exception:
            page.reload()
            with page.expect_response(lambda res: "?route=group-list" in res.url):
                pass

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

def test_add_one_expense(page: Page):
    wait_for_app_ready(page)

    # Create a group
    page.get_by_role("button", name="+").last.click()
    modal = page.locator("#new-group-modal.is-active").last
    modal.get_by_placeholder("e.g., Holiday Trip").fill("Expense Test")
    modal.get_by_placeholder("Comma-separated names").fill("Alice, Bob")
    modal.get_by_role("button", name="Save changes").click()

    # Go to group details
    page.get_by_role("link", name="Expense Test").click()

    # Add an expense
    page.get_by_role("button", name="Add Expense").click()
    expense_modal = page.locator("#add-expense-modal.is-active").last
    expect(expense_modal).to_be_visible()
    expense_modal.get_by_placeholder("e.g., Groceries").fill("Lunch")
    expense_modal.get_by_placeholder("e.g., 25.50").fill("20.00")
    expense_modal.locator('select[name="payer"]').select_option(label="Alice")

    # After clicking, two requests should be triggered by the 'expense-added' event
    with page.expect_response(lambda res: "?route=expense-list" in res.url), \
         page.expect_response(lambda res: "?route=group-balances" in res.url):
        expense_modal.get_by_role("button", name="Save Expense").click()

    page.screenshot(path="screenshot_one_expense_after_add.png")

    # Check that the expense is listed
    expense_list = page.get_by_test_id("expense-list")
    expense_box = expense_list.locator(".box", has_text="Lunch")
    expect(expense_box.get_by_text("Amount: 20,00 €")).to_be_visible()
    expect(expense_box.get_by_text("Paid by: Alice")).to_be_visible()

    # Check that the balances are correct
    # Alice paid 20.00 for a 20.00 expense split two ways.
    # Alice's share is 10.00. Alice is owed 10.00.
    # Bob's share is 10.00. Bob owes 10.00.
    balances_summary = page.get_by_test_id("balances-summary")
    expect(balances_summary.get_by_text("Alice is owed 10,00 €")).to_be_visible()
    expect(balances_summary.get_by_text("Bob owes 10,00 €")).to_be_visible()


def test_add_two_expenses(page: Page):
    wait_for_app_ready(page)

    # Create a group
    page.get_by_role("button", name="+").last.click()
    modal = page.locator("#new-group-modal.is-active").last
    modal.get_by_placeholder("e.g., Holiday Trip").fill("Two Expenses Test")
    modal.get_by_placeholder("Comma-separated names").fill("Alice, Bob")
    modal.get_by_role("button", name="Save changes").click()

    # Go to group details
    page.get_by_role("link", name="Two Expenses Test").click()

    # Add first expense
    page.get_by_role("button", name="Add Expense").click()
    expense_modal = page.locator("#add-expense-modal.is-active").last
    expense_modal.get_by_placeholder("e.g., Groceries").fill("Lunch")
    expense_modal.get_by_placeholder("e.g., 25.50").fill("20.00")
    expense_modal.locator('select[name="payer"]').select_option(label="Alice")
    with page.expect_response(lambda res: "?route=expense-list" in res.url), \
         page.expect_response(lambda res: "?route=group-balances" in res.url):
        expense_modal.get_by_role("button", name="Save Expense").click()

    page.screenshot(path="screenshot_two_expenses_1_after_first_add.png")

    # Add second expense
    page.get_by_role("button", name="Add Expense").click()
    expense_modal = page.locator("#add-expense-modal.is-active").last
    expense_modal.get_by_placeholder("e.g., Groceries").fill("Dinner")
    expense_modal.get_by_placeholder("e.g., 25.50").fill("30.00")
    expense_modal.locator('select[name="payer"]').select_option(label="Bob")
    with page.expect_response(lambda res: "?route=expense-list" in res.url), \
         page.expect_response(lambda res: "?route=group-balances" in res.url):
        expense_modal.get_by_role("button", name="Save Expense").click()

    page.screenshot(path="screenshot_two_expenses_2_after_second_add.png")

    # Check that the expenses are listed
    expense_list = page.get_by_test_id("expense-list")
    lunch_box = expense_list.locator(".box", has_text="Lunch")
    expect(lunch_box.get_by_text("Amount: 20,00 €")).to_be_visible()
    expect(lunch_box.get_by_text("Paid by: Alice")).to_be_visible()

    dinner_box = expense_list.locator(".box", has_text="Dinner")
    expect(dinner_box.get_by_text("Amount: 30,00 €")).to_be_visible()
    expect(dinner_box.get_by_text("Paid by: Bob")).to_be_visible()

    # Check that the balances are correct
    # Total expenses: 50.00. Each person's share: 25.00
    # Alice paid 20.00, share is 25.00 -> Alice owes 5.00
    # Bob paid 30.00, share is 25.00 -> Bob is owed 5.00
    balances_summary = page.get_by_test_id("balances-summary")
    expect(balances_summary.get_by_text("Alice owes 5,00 €")).to_be_visible()
    expect(balances_summary.get_by_text("Bob is owed 5,00 €")).to_be_visible()
