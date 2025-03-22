/*
  Warnings:

  - Added the required column `salt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `user` ADD COLUMN `salt` VARCHAR(255) NOT NULL DEFAULT 'temp_salt';

-- After the migration, you should update all existing users with proper salt values
