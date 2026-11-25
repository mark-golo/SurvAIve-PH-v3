-- SMS Emergency Fallback — MySQL migration
-- Adds source channel tracking to sos_reports and creates the SMS communication log table.

ALTER TABLE sos_reports
  ADD COLUMN IF NOT EXISTS source_channel       ENUM('internet','sms','queue_sync') NOT NULL DEFAULT 'internet',
  ADD COLUMN IF NOT EXISTS sms_sender_number    VARCHAR(20)  NULL,
  ADD COLUMN IF NOT EXISTS sms_provider_msg_id  VARCHAR(100) NULL;

CREATE TABLE IF NOT EXISTS sms_communication_log (
  id               INT          AUTO_INCREMENT PRIMARY KEY,
  report_id        INT          NULL,
  channel          ENUM('native_sms','philsms') NOT NULL,
  direction        ENUM('inbound','outbound')   NOT NULL,
  provider_msg_id  VARCHAR(100) NULL,
  sender_number    VARCHAR(20)  NULL,
  recipient_number VARCHAR(20)  NULL,
  status           VARCHAR(30)  NOT NULL DEFAULT 'pending',
  attempt_count    TINYINT UNSIGNED NOT NULL DEFAULT 1,
  error_code       VARCHAR(50)  NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sms_report_id        (report_id),
  INDEX idx_sms_provider_msg_id  (provider_msg_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
