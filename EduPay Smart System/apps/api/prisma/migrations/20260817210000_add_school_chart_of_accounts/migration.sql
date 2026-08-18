ALTER TABLE "ExpenseCategory"
  ADD COLUMN "accountCode" TEXT,
  ADD COLUMN "accountClass" INTEGER;

ALTER TABLE "Expense"
  ADD COLUMN "cashAccountCode" TEXT;

CREATE INDEX "ExpenseCategory_schoolId_accountClass_accountCode_idx"
  ON "ExpenseCategory"("schoolId", "accountClass", "accountCode");
