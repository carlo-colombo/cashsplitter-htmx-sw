
import re
from playwright.sync_api import Page, expect

BASE_URL = "http://localhost:8000"

def wait_for_app_ready(page: Page):
    """
    Navigates to the base URL and waits for the app to signal it's ready.
    """
    page.goto(BASE_URL)
    page.locator('body[data-app-ready="true"]').wait_for(timeout=10000)

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
