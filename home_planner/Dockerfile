ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js
RUN apk add --no-cache nodejs npm

# Copy app
WORKDIR /app
COPY package.json ./
COPY src/ ./src/
COPY public/ ./public/

# Copy run script
COPY run.sh /run.sh
RUN chmod +x /run.sh

CMD ["/run.sh"]

# rebuild trigger
