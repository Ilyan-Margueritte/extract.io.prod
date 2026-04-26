FROM mcr.microsoft.com/playwright/python:v1.41.2-jammy

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --timeout=120 --retries=5 -r requirements.txt

# Playwright browsers are already installed in this image
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Copy application source
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
