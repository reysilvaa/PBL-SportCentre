-- AlterTable
ALTER TABLE `Booking` ADD COLUMN `status` ENUM('active', 'completed', 'cancelled') NOT NULL DEFAULT 'active';
