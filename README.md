# CashSplitter

CashSplitter is a local-first, offline-capable financial ledger application designed for easy expense tracking and splitting among groups. It's built with a "Zero-Build Stack," emphasizing simplicity and modern web standards.

## Tech Stack

*   **Frontend:**
    *   **Vanilla JavaScript:** For all client-side logic.
    *   **htmx:** For efficient and simple UI updates without complex JavaScript frameworks.
    *   **Bulma:** A modern CSS framework for clean and responsive design.
*   **Storage:**
    *   **Dexie.js:** A wrapper for IndexedDB, providing a robust local database solution.
*   **Core Logic:**
    *   **Service Worker:** Handles all application logic, including routing, database interactions, and offline capabilities.
*   **Testing:**
    *   **Python:** The test environment is managed with Python.
    *   **uv:** For managing Python dependencies.
    *   **pytest:** The testing framework.
    *   **pytest-playwright:** For end-to-end testing.

## Features

*   **Offline-First:** The application is fully functional without an internet connection.
*   **Group-Based Expense Tracking:** Create groups and track expenses within them.
*   **Event Sourcing:** User actions are recorded as events, providing a reliable and auditable system.
*   **Double-Entry Accounting:** Ensures financial integrity and accurate balance calculations.
*   **Responsive Design:** The UI is mobile-first and works seamlessly across all devices.

## Getting Started

To run the application locally, you need Python 3.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/carlo-colombo/cashsplitter-htmx-sw.git
    cd cashsplitter-htmx-sw
    ```

2.  **Start a web server:**
    ```bash
    python3 -m http.server
    ```

3.  **Open the application in your browser:**
    Navigate to `http://localhost:8000`

## Running Tests

The project uses Playwright for end-to-end testing.

1.  **Set up the Python environment and install dependencies:**
    ```bash
    uv venv
    uv sync
    ```

2.  **Install Playwright browsers:**
    ```bash
    uv run playwright install --with-deps
    ```

3.  **Run the tests:**
    ```bash
    uv run pytest
    ```

## Contributing

We welcome contributions to CashSplitter! To ensure the quality and stability of the application, please adhere to the following guidelines:

*   **Test All New Features:** Any new feature or enhancement must be accompanied by corresponding tests. This helps prevent regressions and ensures the long-term maintainability of the codebase.
*   **Follow Existing Style:** Please maintain the existing coding style and conventions.
