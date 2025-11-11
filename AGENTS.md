# AGENTS.md

This document provides guidance for AI agents working on the CashSplitter codebase.

## Project Overview

*   **Name:** CashSplitter
*   **Description:** A local-first, offline-capable financial ledger application.
*   **Tech Stack:** "Zero-Build Stack" - Vanilla JavaScript, htmx, Bulma, Dexie.js, and a Service Worker.
*   **Testing:** Python with `uv`, `pytest`, and `pytest-playwright`.
*   **Core Files:** `index.html` and `sw.js`.

## Core Concepts

*   **Service Worker (`sw.js`):** The heart of the application. It intercepts all network requests and serves the appropriate content, handles database operations, and manages the application's logic. For navigation requests (`event.request.mode === 'navigate'`), it serves the main `index.html` shell.
*   **Event Sourcing:** All state changes are initiated by events (e.g., `GROUP_CREATED`, `EXPENSE_ADDED`, `GROUP_DELETED`). These events are stored in an append-only log in IndexedDB.
*   **Projections:** The UI is rendered based on projections, which are materialized views of the event log. The `recalculateProjections` function in `sw.js` is responsible for building these projections in a single pass.
*   **Double-Entry Accounting:** All financial transactions are recorded using a double-entry system to ensure accuracy. Member-specific accounts follow the pattern `Assets:Debtors:<memberId>` or `Liabilities:Creditors:<memberId>`.
*   **Local-First:** The application must be fully functional offline. All data is stored locally in the browser's IndexedDB.

## Database Schema

*   **Database Name:** `LedgerDB`
*   **Object Stores:**
    *   `events`: An append-only log of all user actions.
    *   `projections`: Materialized views for the UI. This includes `group_list` and `group_balances_<groupId>`.

## Development Guidelines

*   **No Build Step:** This is a "Zero-Build Stack" project. Do not add any build tools or transpilers.
*   **Relative Paths:** All file paths must be relative to ensure the application works when deployed to a subpath.
*   **Monetary Values:** Store all monetary values as integers (cents) to avoid floating-point errors. For expenses with non-divisible equal splits, the rounding remainder must be assigned to the last beneficiary/beneficiaries.
*   **htmx API Conventions:** For POST requests that modify data, the service worker should respond with a 204 No Content status and an `HX-Trigger` header to allow multiple UI components to refresh.

## Playwright Testing

*   **Race Conditions:** The `index.html` file contains logic to reload the page if `navigator.serviceWorker.controller` is null. This can cause severe race conditions for Playwright.
*   **Locators:**
    *   `get_by_label` can be unreliable. Prefer `get_by_placeholder` or CSS attribute selectors.
    *   Handle htmx's content swapping by targeting the last instance of an element (e.g., `.last`).

## Test Coverage

It is critical that all user-facing features are covered by end-to-end Playwright tests. Before submitting, ensure your changes are accompanied by corresponding tests.

### Feature Checklist:

*   **Group Management:**
    *   [x] Create a new group.
    *   [x] View group details (members, balances).
    *   [x] Delete a group.
    *   [ ] Edit a group (rename, add/remove members).
*   **Expense Management:**
    *   [ ] Add a new expense.
    *   [ ] View expense details.
    *   [ ] Edit an expense.
    *   [ ] Delete an expense.
*   **Balance Calculation:**
    *   [ ] Verify correct balance calculation for a single expense.
    *   [ ] Verify correct balance calculation for multiple expenses.
    *   [ ] Verify correct handling of unequal splits.
    *   [ ] Verify correct handling of rounding for non-divisible amounts.
*   **Offline Functionality:**
    *   [ ] Verify that the application is accessible offline.
    *   [ ] Verify that actions performed offline are synced when the connection is restored.

## Running the Application and Tests

*   **Running the App:**
    1.  Start a web server: `python3 -m http.server`
    2.  Open in browser: `http://localhost:8000`

*   **Running Tests:**
    1.  Set up the environment: `uv venv && uv sync`
    2.  Install Playwright browsers: `uv run playwright install --with-deps`
    3.  Run tests: `uv run pytest`
    4.  Run tests in headed mode for debugging: `uv run pytest --headed` (use `xvfb-run` in headless environments).
