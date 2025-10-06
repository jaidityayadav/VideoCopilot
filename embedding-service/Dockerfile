# ===== Stage 1: Builder =====
FROM python:3.11-slim AS builder

# Environment variables for pip & Python
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory in builder
WORKDIR /tmp

# Copy only requirements for caching
COPY requirements.txt .

# Install dependencies into a custom prefix to keep the image small
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ===== Stage 2: Production =====
FROM python:3.11-slim

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -m -d /home/appuser appuser

# Copy installed dependencies from builder
COPY --from=builder /install /opt/venv

# Set PATH
ENV PATH="/opt/venv/bin:$PATH"

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy only application code
COPY . .

# Create necessary directories including cache
RUN mkdir -p /app/models /app/logs /app/.cache \
    && chown -R appuser:appuser /app \
    && chown -R appuser:appuser /home/appuser

# Set environment variables for ML model caches
ENV TRANSFORMERS_CACHE=/app/.cache/transformers
ENV HF_HOME=/app/.cache/huggingface

# Switch to non-root user
USER appuser

# Expose port 8001
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Start application
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]