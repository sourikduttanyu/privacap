CREATE TABLE IF NOT EXISTS impression_log (
  report_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id  TEXT        NOT NULL,
  noisy_value INT        NOT NULL,
  epsilon    FLOAT       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- no user_id column. intentional. server never sees true individual count.
);

CREATE INDEX idx_impression_log_cohort ON impression_log (cohort_id);
CREATE INDEX idx_impression_log_created ON impression_log (created_at);
