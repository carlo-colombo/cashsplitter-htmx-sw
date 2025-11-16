FROM node:20-bookworm

WORKDIR /app

# Copy dependency files and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Install Playwright browsers
RUN npx playwright install --with-deps

# Copy the rest of the application files
COPY . .

# Command to run the tests
CMD ["bash", "-c", "nohup npx http-server . -p 8000 > server.log 2>&1 & sleep 2 && npx playwright test"]
