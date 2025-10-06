
# ===== Stage 1: Builder =====
FROM python:3.11-slim AS builder

# Set Prisma Python cache to writable location
ENV PRISMA_PYTHON_CACHE=/app/.cache/prisma-python

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
COPY requirements.txt .

# Create virtual environment and install requirements
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# ===== Stage 2: Production =====
FROM python:3.11-slim

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -m -d /home/appuser appuser

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install runtime dependencies (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

# Set working directory
WORKDIR /app


# Copy application code
COPY . /app/

# Generate Prisma client during build (as root)
WORKDIR /app
RUN /opt/venv/bin/prisma generate || true

# Create required directories
RUN mkdir -p /app/uploads /app/temp /app/models /app/logs /app/.cache \
    && chown -R appuser:appuser /app \
    && chown -R appuser:appuser /home/appuser


# Set environment variables
ENV PRISMA_PYTHON_CACHE=/app/.cache/prisma-python


# Remove any root-owned Prisma cache to avoid permission issues
RUN rm -rf /root/.cache/prisma-python || true

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start application
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
