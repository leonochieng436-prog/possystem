-- AlterTable
ALTER TABLE "cash_sessions" ADD COLUMN     "cashRemoved" DECIMAL(14,2),
ADD COLUMN     "closingFloat" DECIMAL(14,2),
ADD COLUMN     "closingNote" TEXT,
ADD COLUMN     "denominationCounts" JSONB,
ADD COLUMN     "varianceReason" TEXT;
