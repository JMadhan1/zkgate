FROM python:3.15.0-slim

WORKDIR /app

# py_ecc is pure Python, so no build toolchain is needed — keep the image slim.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin zkgate

# Code is owned by root and only readable by the app user: the process can't
# modify itself even if compromised.
COPY --chown=root:root . .

# Circuit verification keys are mounted at /app/circuits/keys by docker-compose
# (read-only). CIRCUIT_KEYS_DIR points the verifier at them.
ENV CIRCUIT_KEYS_DIR=/app/circuits/keys \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

USER 10001

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"

# --no-server-header: don't advertise the server/version.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header", "--no-date-header"]
