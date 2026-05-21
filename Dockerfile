FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install latest yt-dlp
RUN pip install --upgrade yt-dlp

# Copy application
COPY app.py .

# Verify yt-dlp works
RUN yt-dlp --version

EXPOSE 10000

CMD ["python", "app.py"]
