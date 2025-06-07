-- AlterTable
ALTER TABLE `Payment` MODIFY `paymentMethod` ENUM('gopay', 'shopeepay', 'qris', 'bca_va', 'bri_va', 'bni_va', 'permata_va', 'mandiri_bill', 'mandiri_va', 'cimb_va', 'danamon_va', 'indomaret', 'alfamart', 'akulaku', 'kredivo', 'dana', 'credit_card', 'cash', 'paypal', 'google_pay') NULL;
