#!/bin/sh

# Simple script to run seed and start server
echo "Starting backend..."

# Optionally run seed script
echo "Running seed script to ensure DB is populated..."
npm run seed || true

# Start the actual server
echo "Starting API server..."
npm start
