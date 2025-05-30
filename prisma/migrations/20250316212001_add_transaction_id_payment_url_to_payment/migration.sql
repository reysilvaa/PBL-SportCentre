-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `paymentUrl` TEXT NULL,
    ADD COLUMN `transactionId` VARCHAR(255) NULL;
