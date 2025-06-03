FROM node:20-alpine
WORKDIR /app

# Copy package.json and package-lock.json
COPY frontend/package.json frontend/pnpm-lock.yaml* ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies using pnpm, ensuring it adheres to the lockfile
RUN pnpm install --frozen-lockfile

# Copy the rest of the frontend application code (will be mostly overridden by volume mount)
COPY frontend/ ./ 

# Expose Vite's default port
EXPOSE 5173

# Run the Vite development server
# --host 0.0.0.0 makes it accessible from outside the container
CMD ["pnpm", "run", "start"]
