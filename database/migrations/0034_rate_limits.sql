-- Counters for the rate limiter (sign-in, sign-up, password reset, order creation, ...). One row per limited subject and time window;
-- only a short hash of the subject is stored. Old windows are removed by the daily clean-up.
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "window" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,
    "expires_at" INTEGER NOT NULL,
    PRIMARY KEY ("key", "window")
);

CREATE INDEX "rate_limits_expires_at_idx" ON "rate_limits"("expires_at");
