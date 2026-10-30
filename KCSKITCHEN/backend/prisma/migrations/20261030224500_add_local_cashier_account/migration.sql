CREATE TABLE "KitchenCashierAccount" (
  "id" TEXT NOT NULL DEFAULT 'primary',
  "fullName" TEXT NOT NULL DEFAULT 'Kitchen Cashier',
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "updatedBy" TEXT NOT NULL,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KitchenCashierAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KitchenCashierAccount_email_key" ON "KitchenCashierAccount"("email");
