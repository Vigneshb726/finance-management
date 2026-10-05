-- Money is now stored as integer paise (₹1 = 100). Existing rupee values are
-- multiplied by 100 — the USING clauses are the data conversion, not just a type change.

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- AlterTable: rupees (NUMERIC 14,2) → paise (BIGINT)
ALTER TABLE "Budget" ALTER COLUMN "totalAmount" SET DATA TYPE BIGINT USING round("totalAmount" * 100)::BIGINT;

ALTER TABLE "BudgetCategory" ALTER COLUMN "amount" SET DATA TYPE BIGINT USING round("amount" * 100)::BIGINT;

ALTER TABLE "FinancialGoal" ALTER COLUMN "targetAmount" SET DATA TYPE BIGINT USING round("targetAmount" * 100)::BIGINT,
ALTER COLUMN "currentAmount" SET DEFAULT 0,
ALTER COLUMN "currentAmount" SET DATA TYPE BIGINT USING round("currentAmount" * 100)::BIGINT;

ALTER TABLE "Transaction" ADD COLUMN     "recurringId" TEXT,
ALTER COLUMN "amount" SET DATA TYPE BIGINT USING round("amount" * 100)::BIGINT;

-- CreateTable
CREATE TABLE "RecurringTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "nextDate" DATE,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringTransaction_userId_isActive_nextDate_idx" ON "RecurringTransaction"("userId", "isActive", "nextDate");

-- CreateIndex
CREATE INDEX "RecurringTransaction_categoryId_idx" ON "RecurringTransaction"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_recurringId_date_key" ON "Transaction"("recurringId", "date");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
