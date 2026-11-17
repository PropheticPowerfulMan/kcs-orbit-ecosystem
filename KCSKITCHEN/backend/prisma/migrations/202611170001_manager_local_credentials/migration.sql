CREATE TABLE "KitchenManagerCredential" (
 "id" TEXT NOT NULL, "orbitPersonId" TEXT NOT NULL, "nexusUserId" TEXT NOT NULL,
 "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "KitchenManagerCredential_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KitchenManagerCredential_orbitPersonId_key" ON "KitchenManagerCredential"("orbitPersonId");
CREATE UNIQUE INDEX "KitchenManagerCredential_nexusUserId_key" ON "KitchenManagerCredential"("nexusUserId");
CREATE UNIQUE INDEX "KitchenManagerCredential_email_key" ON "KitchenManagerCredential"("email");
