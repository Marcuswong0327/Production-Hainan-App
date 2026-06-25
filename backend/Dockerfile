# Supabase Edge Functions runtime (Deno)
FROM supabase/edge-runtime:v1.67.4

WORKDIR /home/deno/functions

COPY functions/ ./

ENV SUPABASE_URL=http://database:5432
ENV VERIFY_JWT=false

# Default function; override with docker-compose command per service
CMD ["start", "--main-service", "send-fcm-notifications"]
