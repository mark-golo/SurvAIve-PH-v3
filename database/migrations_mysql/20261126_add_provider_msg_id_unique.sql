-- Add UNIQUE constraint to sms_communication_log.provider_msg_id
-- Multiple NULLs are allowed in a MySQL UNIQUE index (NULL != NULL),
-- so records without a provider_msg_id do not conflict with each other.
-- Uses information_schema checks for MySQL 5.7 / MariaDB compatibility.

-- Step 1: Drop old plain index if it exists
SET @drop_old = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name   = 'sms_communication_log'
        AND index_name   = 'idx_sms_comm_log_provider_msg_id'
    ),
    'ALTER TABLE sms_communication_log DROP INDEX idx_sms_comm_log_provider_msg_id',
    'SELECT 1'
  )
);
PREPARE _stmt FROM @drop_old;
EXECUTE _stmt;
DEALLOCATE PREPARE _stmt;

-- Step 2: Add UNIQUE index if it does not already exist
SET @add_uniq = (
  SELECT IF(
    NOT EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name   = 'sms_communication_log'
        AND index_name   = 'uniq_provider_msg_id'
    ),
    'ALTER TABLE sms_communication_log ADD UNIQUE INDEX uniq_provider_msg_id (provider_msg_id)',
    'SELECT 1'
  )
);
PREPARE _stmt FROM @add_uniq;
EXECUTE _stmt;
DEALLOCATE PREPARE _stmt;
