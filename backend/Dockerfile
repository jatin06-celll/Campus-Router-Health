FROM node:20-alpine

WORKDIR /app

# Copy root CSV files needed for seeding
COPY routers.csv metrics.csv COMPLA_1.CSV ./

# Create backend directory
WORKDIR /app/backend

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm install

# Copy backend source
COPY backend/ .

# Expose API port
EXPOSE 5000

# Script to wait for DB, run seed if necessary, then start
COPY backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

CMD ["./docker-entrypoint.sh"]
