# ===== Stage 1: Builder =====
FROM python:3.11-slim AS builder

# Environment variables
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
    wget \
    && rm -rf /var/lib/apt/lists/*

# Working directory for building
WORKDIR /tmp

# Copy only requirements for caching
COPY video-processing-service/requirements.txt .

# Install dependencies into a custom folder
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ===== Stage 2: Production =====
FROM python:3.11-slim

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -m -d /home/appuser appuser

# Copy installed dependencies from builder
COPY --from=builder /install /opt/venv

# Set PATH
ENV PATH="/opt/venv/bin:$PATH"

# Install runtime dependencies (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

# Set working directory
WORKDIR /app

# Copy only application code
COPY video-processing-service/ /app/

# Create required directories
RUN mkdir -p /app/uploads /app/temp /app/models /app/logs /app/.cache \
    && chown -R appuser:appuser /app \
    && chown -R appuser:appuser /home/appuser

# Set environment variables
ENV PRISMA_PYTHON_CACHE=/app/.cache/prisma-python

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start application
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
