
import re
from playwright.sync_api import Page, expect

BASE_URL = "http://localhost:8000"

def wait_for_app_ready(page: Page):
    """
    Navigates to the base URL and waits for the app to signal it's ready.
    """
    page.goto(BASE_URL)
    page.locator('body[data-app-ready="true"]').wait_for(timeout=10000)

def test_title_link_navigates_home(page: Page):
    """
    Tests that clicking the 'CashSplitter' title navigates back to the group list view.
    """
    wait_for_app_ready(page)

    # 1. Create a group to navigate away from the home page
    page.get_by_role("button", name="+").last.click()
    modal = page.locator("#new-group-modal.is-active").last
    modal.get_by_placeholder("e.g., Holiday Trip").fill("Nav Test Group")
    modal.get_by_placeholder("Comma-separated names").fill("Alice")
    modal.get_by_role("button", name="Save changes").click()
    expect(page.get_by_role("link", name="Nav Test Group")).to_be_visible()

    # 2. Go to the group's detail page
    page.get_by_role("link", name="Nav Test Group").click()
    expect(page.locator("h2.title", has_text="Nav Test Group")).to_be_visible()
    expect(page.get_by_text("No groups yet.")).not_to_be_visible()


    # 3. Click the main title
    page.get_by_role("heading", name="CashSplitter").click()

    # 4. Verify we are back on the group list page
    expect(page.get_by_role("link", name="Nav Test Group")).to_be_visible()
    expect(page.locator("h2.title", has_text="Nav Test Group")).not_to_be_visible()
