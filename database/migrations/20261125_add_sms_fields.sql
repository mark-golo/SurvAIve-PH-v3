-- SMS Emergency Fallback — Supabase/PostgreSQL migration

ALTER TABLE sos_reports
  ADD COLUMN IF NOT EXISTS source_channel      TEXT NOT NULL DEFAULT 'internet'
    CHECK (source_channel IN ('internet','sms','queue_sync')),
  ADD COLUMN IF NOT EXISTS sms_sender_number   VARCHAR(20)  NULL,
  ADD COLUMN IF NOT EXISTS sms_provider_msg_id VARCHAR(100) NULL;

CREATE TABLE IF NOT EXISTS sms_communication_log (
  id               BIGSERIAL    PRIMARY KEY,
  report_id        BIGINT       NULL,
  channel          TEXT         NOT NULL CHECK (channel IN ('native_sms','philsms')),
  direction        TEXT         NOT NULL CHECK (direction IN ('inbound','outbound')),
  provider_msg_id  VARCHAR(100) NULL,
  sender_number    VARCHAR(20)  NULL,
  recipient_number VARCHAR(20)  NULL,
  status           VARCHAR(30)  NOT NULL DEFAULT 'pending',
  attempt_count    SMALLINT     NOT NULL DEFAULT 1,
  error_code       VARCHAR(50)  NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_report_id       ON sms_communication_log (report_id);
CREATE INDEX IF NOT EXISTS idx_sms_provider_msg_id ON sms_communication_log (provider_msg_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_sms_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sms_log_updated_at ON sms_communication_log;
CREATE TRIGGER trg_sms_log_updated_at
  BEFORE UPDATE ON sms_communication_log
  FOR EACH ROW EXECUTE FUNCTION update_sms_log_updated_at();
