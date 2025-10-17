# Stage 1: Build the Next.js application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

# Copy the rest of the application source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Create the final production image
FROM node:20-alpine AS runner

WORKDIR /app

# Copy the standalone application
COPY --from=builder /app/.next/standalone ./

# Copy the public folder
COPY --from=builder /app/public ./public

# Copy the static assets
COPY --from=builder /app/.next/static ./.next/static

# Copy the run script
COPY --from=builder /app/run.sh ./run.sh

# Copy the scheduled jobs
COPY --from=builder /app/scheduled-jobs.json ./scheduled-jobs.json

# Expose the port Next.js runs on
EXPOSE 3000

# Command to run the application
CMD /bin/bash run.sh