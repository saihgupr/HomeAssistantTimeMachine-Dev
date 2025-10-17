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

# Copy package files and install only production dependencies
COPY package.json package-lock.json ./
RUN npm install --omit=dev --legacy-peer-deps

# Copy the built application from the builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/run.sh ./run.sh
COPY --from=builder /app/scheduled-jobs.json ./scheduled-jobs.json
COPY --from=builder /app/package.json ./package.json

# Expose the port Next.js runs on
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]
