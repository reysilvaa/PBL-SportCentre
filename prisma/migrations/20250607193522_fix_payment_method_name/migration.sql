/*
  Warnings:

  - You are about to drop the column `payment_paymentMethod` on the `payment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `payment` DROP COLUMN `payment_paymentMethod`,
    ADD COLUMN `paymentMethod` ENUM('gopay', 'shopeepay', 'qris', 'bca_va', 'bri_va', 'bni_va', 'permata_va', 'mandiri_bill', 'cimb_va', 'danamon_va', 'indomaret', 'alfamart', 'akulaku', 'kredivo', 'dana', 'credit_card', 'cash') NULL;
