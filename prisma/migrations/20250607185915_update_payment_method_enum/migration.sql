/*
  Warnings:

  - You are about to alter the column `paymentMethod` on the `payment` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(0))` to `Enum(EnumId(3))`.

*/
-- AlterTable
ALTER TABLE `payment` MODIFY `paymentMethod` ENUM('gopay', 'shopeepay', 'qris', 'bca_va', 'bri_va', 'bni_va', 'permata_va', 'mandiri_bill', 'cimb_va', 'danamon_va', 'indomaret', 'alfamart', 'akulaku', 'kredivo', 'dana', 'credit_card', 'cash') NULL;
