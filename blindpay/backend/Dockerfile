FROM python:3.12.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin blindpay
COPY --chown=root:root app ./app

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 BLINDPAY_ENVIRONMENT=production
USER 10001
EXPOSE 8010
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8010/health').status==200 else 1)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010", "--no-server-header", "--no-date-header"]
