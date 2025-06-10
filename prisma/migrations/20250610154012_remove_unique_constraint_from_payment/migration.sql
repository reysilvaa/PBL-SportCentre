-- DropForeignKey
ALTER TABLE `Payment` DROP FOREIGN KEY `Payment_bookingId_fkey`;

-- DropIndex
DROP INDEX `Payment_bookingId_key` ON `Payment`;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
