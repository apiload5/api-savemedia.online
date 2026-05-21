FROM node:18-bullseye

# Python, pip, ffmpeg install
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp install (multiple methods)
RUN pip3 install yt-dlp --upgrade --break-system-packages || \
    pip3 install yt-dlp --upgrade || \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp

# Verify installation
RUN yt-dlp --version || echo "yt-dlp verification failed"

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY server.js .

# Check again at runtime
RUN yt-dlp --version

EXPOSE 3000
CMD ["node", "server.js"]
