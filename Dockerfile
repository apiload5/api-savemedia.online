FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app.py .

# Install yt-dlp (extra assurance)
RUN pip install --upgrade yt-dlp

EXPOSE 10000

CMD ["python", "app.py"]
