/*
  Warnings:

  - You are about to drop the column `paymentStatus` on the `booking` table. All the data in the column will be lost.
  - You are about to drop the column `bookingId` on the `payment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[paymentId]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `payment` DROP FOREIGN KEY `Payment_bookingId_fkey`;

-- DropIndex
DROP INDEX `Payment_bookingId_fkey` ON `payment`;

-- AlterTable
ALTER TABLE `booking` DROP COLUMN `paymentStatus`,
    ADD COLUMN `paymentId` INTEGER NULL;

-- AlterTable
ALTER TABLE `payment` DROP COLUMN `bookingId`;

-- CreateIndex
CREATE UNIQUE INDEX `Booking_paymentId_key` ON `Booking`(`paymentId`);

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
