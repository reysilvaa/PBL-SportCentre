-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('super_admin', 'admin_cabang', 'owner_cabang', 'user') NOT NULL DEFAULT 'user';
