FROM node:20-alpine

WORKDIR /app

# Install dependencies first for fast layer caching
COPY package*.json ./
RUN npm install --production

# Copy application files
COPY . .

# Persistent data directory
VOLUME ["/app/data"]

ENV PORT=8085
EXPOSE 8085

CMD ["node", "server.js"]
