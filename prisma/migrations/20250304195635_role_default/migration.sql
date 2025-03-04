-- AlterTable
ALTER TABLE `user` MODIFY `role` ENUM('super_admin', 'admin_cabang', 'owner_cabang', 'user') NOT NULL DEFAULT 'user';
