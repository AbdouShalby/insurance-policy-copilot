FROM python:3.12-slim
WORKDIR /app
COPY services/ingest/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/ingest/*.py ./
EXPOSE 8001
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
