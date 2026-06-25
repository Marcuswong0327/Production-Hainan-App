FROM postgres:16-alpine

COPY docker-entrypoint-initdb.d/ /docker-entrypoint-initdb.d/
COPY migrations/ /migrations/
COPY sql/ /sql/
