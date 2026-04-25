/*
  Warnings:

  - You are about to drop the column `activeIssueSince` on the `Beat` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Beat" DROP COLUMN "activeIssueSince",
ADD COLUMN     "editorSessionId" TEXT;
