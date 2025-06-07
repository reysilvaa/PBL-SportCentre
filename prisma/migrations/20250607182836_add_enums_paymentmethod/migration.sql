-- Migrasi kosong sementara 

-- Modifikasi kolom paymentMethod pada tabel payment untuk menggunakan enum PaymentMethod baru
-- Pertama, hapus constraint enum lama
ALTER TABLE `Payment` MODIFY `paymentMethod` VARCHAR(255);

-- Kemudian, atur ulang kolom dengan enum baru
ALTER TABLE `Payment` MODIFY `paymentMethod` ENUM('gopay', 'shopeepay', 'qris', 'bca_va', 'bri_va', 'bni_va', 'permata_va', 'mandiri_bill', 'cimb_va', 'danamon_va', 'indomaret', 'alfamart', 'akulaku', 'kredivo', 'dana', 'credit_card', 'cash') NULL; 