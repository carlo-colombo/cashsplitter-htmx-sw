#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Define the image name and tag
IMAGE_NAME="cashsplitter-tests"
IMAGE_TAG="latest"

# Build the Docker image
echo "Building Docker image: $IMAGE_NAME:$IMAGE_TAG..."
docker build -t "$IMAGE_NAME:$IMAGE_TAG" .

# Run the tests inside the Docker container
# The --rm flag removes the container after it exits.
# We use --network=host to allow the tests running in the container to access
# the web server started on localhost.
echo "Running tests in Docker container..."
docker run --rm --network=host "$IMAGE_NAME:$IMAGE_TAG" bash -c "nohup npx http-server . -p 8000 > server.log 2>&1 & sleep 2 && npx playwright test"
