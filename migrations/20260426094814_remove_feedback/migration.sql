/*
  Warnings:

  - You are about to drop the column `feedback` on the `IssueItem` table. All the data in the column will be lost.
  - You are about to drop the column `feedbackAt` on the `IssueItem` table. All the data in the column will be lost.
  - You are about to drop the column `feedbackToken` on the `IssueItem` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "IssueItem_feedbackToken_key";

-- AlterTable
ALTER TABLE "IssueItem" DROP COLUMN "feedback",
DROP COLUMN "feedbackAt",
DROP COLUMN "feedbackToken";
