-- AlterTable
ALTER TABLE `booking` ADD COLUMN `status` ENUM('active', 'completed', 'cancelled') NOT NULL DEFAULT 'active';
