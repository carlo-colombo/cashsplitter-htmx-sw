# Use the official Playwright image with Python
FROM mcr.microsoft.com/playwright/python:v1.55.0-jammy

# Set the working directory
WORKDIR /app

# Install uv
RUN pip install uv

# Copy dependency files and install dependencies
COPY pyproject.toml uv.lock ./
RUN uv sync

# Copy the rest of the application files
COPY . .
