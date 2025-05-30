/*
  Warnings:

  - You are about to drop the column `paymentId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `temp_bookingId` on the `Payment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[bookingId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `bookingId` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Booking` DROP FOREIGN KEY `Booking_paymentId_fkey`;

-- DropIndex
DROP INDEX `Booking_paymentId_key` ON `Booking`;

-- AlterTable
ALTER TABLE `Booking` DROP COLUMN `paymentId`;

-- AlterTable
ALTER TABLE `Payment` DROP COLUMN `temp_bookingId`,
    ADD COLUMN `bookingId` INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Payment_bookingId_key` ON `Payment`(`bookingId`);

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
