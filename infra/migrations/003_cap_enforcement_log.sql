CREATE TABLE IF NOT EXISTS cap_enforcement_log (
  id            BIGSERIAL   PRIMARY KEY,
  cohort_id     TEXT        NOT NULL,
  campaign_id   TEXT        NOT NULL,
  cap_threshold INT         NOT NULL,
  action        TEXT        NOT NULL CHECK (action IN ('serve', 'suppress')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- no user_id column. intentional.
);

CREATE INDEX idx_enforcement_log_cohort_campaign ON cap_enforcement_log (cohort_id, campaign_id);
CREATE INDEX idx_enforcement_log_created ON cap_enforcement_log (created_at);
