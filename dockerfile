
# STAGE 1: Build the React Frontend

FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Install dependencies first for caching
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build


# STAGE 2: Setup the Express Backend

FROM node:20-alpine

WORKDIR /app

# Copy root CSV files needed for database seeding
COPY routers.csv metrics.csv COMPLA_1.CSV ./
ENV CSV_DIR=/app

# Setup backend directory
WORKDIR /app/backend

# Install backend dependencies
COPY backend/package*.json ./
RUN npm install --production

# Copy backend source code
COPY backend/ ./

# Copy the built React app from Stage 1 into the backend's "public" folder
# (Matches the app.use(express.static("public")) you just added!)
COPY --from=frontend-builder /app/frontend/dist ./public

# Expose the API port
EXPOSE 5000

# Start the server (seeds DB first)
CMD ["sh", "-c", "npm run seed && npm start"]
