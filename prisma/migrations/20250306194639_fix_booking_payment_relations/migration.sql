-- First create a temporary column that can be NULL
ALTER TABLE `Payment` ADD COLUMN `temp_bookingId` INT NULL;

-- Then update the temporary column with values from Booking table
-- This assumes that the Booking.paymentId references Payment.id
UPDATE `Payment` AS p
JOIN `Booking` AS b ON b.paymentId = p.id
SET p.temp_bookingId = b.id;

-- For any payments that don't have a booking relationship yet,
-- we need to handle them before making the column NOT NULL
-- Option 1: Delete orphaned payments (if they're not important)
DELETE FROM `Payment` WHERE temp_bookingId IS NULL;

-- Option 2: Or create placeholder bookings for them (uncomment if needed)
-- INSERT INTO `Booking` (userId, fieldId, bookingDate, startTime, endTime, createdAt)
-- SELECT p.userId, 1, NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW()
-- FROM `Payment` p
-- WHERE p.temp_bookingId IS NULL;
-- 
-- UPDATE `Payment` AS p
-- JOIN (
--   SELECT b.id, p.id AS payment_id
--   FROM `Booking` b
--   JOIN `Payment` p ON p.userId = b.userId AND p.temp_bookingId IS NULL
--   WHERE b.paymentId IS N