FROM node:18-bullseye

# Python, pip, ffmpeg aur yt-dlp install karo
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp install karo
RUN pip3 install yt-dlp --upgrade --break-system-packages

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY server.js .

EXPOSE 3000
CMD ["node", "server.js"]
