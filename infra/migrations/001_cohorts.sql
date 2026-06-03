CREATE TABLE IF NOT EXISTS cohorts (
  cohort_id              TEXT        NOT NULL,
  demographic_bucket     TEXT        NOT NULL,
  campaign_id            TEXT        NOT NULL,
  noisy_impression_count BIGINT      NOT NULL DEFAULT 0,
  epsilon_spent          FLOAT       NOT NULL DEFAULT 0.0,
  window_expires_at      TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (cohort_id, campaign_id)
);
-- no user_id column. intentional. PII storage structurally impossible.
