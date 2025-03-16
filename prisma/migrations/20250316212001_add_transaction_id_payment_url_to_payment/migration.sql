-- AlterTable
ALTER TABLE `payment` ADD COLUMN `paymentUrl` TEXT NULL,
    ADD COLUMN `transactionId` VARCHAR(255) NULL;
