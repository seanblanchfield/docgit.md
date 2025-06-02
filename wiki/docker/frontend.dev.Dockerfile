FROM node:20-alpine
WORKDIR /app

# Copy package.json and package-lock.json
COPY frontend/package.json frontend/package-lock.json* ./

# Install dependencies
RUN npm install # Use 'npm install' for dev to allow for potential package.json changes

# Copy the rest of the frontend application code (will be mostly overridden by volume mount)
COPY frontend/ ./ 

# Expose Vite's default port
EXPOSE 5173

# Run the Vite development server
# --host 0.0.0.0 makes it accessible from outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
