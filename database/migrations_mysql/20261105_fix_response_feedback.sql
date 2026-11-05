-- Migration: Fix response_feedback table (MySQL / XAMPP)
-- Fixes: target_id BIGINT cannot store agency-type strings; victim_id made nullable for guests.

-- Change target_id from BIGINT to VARCHAR so agency service-type strings (e.g. 'MDRRMO', 'BFP')
-- are stored correctly instead of being coerced to 0.
ALTER TABLE `response_feedback` MODIFY `target_id` VARCHAR(255) NOT NULL;

-- Make victim_id nullable so guest victims (no account) can still submit feedback.
ALTER TABLE `response_feedback` MODIFY `victim_id` BIGINT UNSIGNED DEFAULT NULL;
