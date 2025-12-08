FROM node:20-slim

WORKDIR /tests

# Copy package files first for better caching
COPY package.json ./

# Install dependencies
RUN npm install

# Copy test source
COPY . .

# Default command runs tests
CMD ["npm", "test"]
