-- CreateTable
CREATE TABLE "GuperTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cartToken" TEXT NOT NULL,
    "shopifyOrderId" TEXT,
    "confirmToken" TEXT NOT NULL,
    "amountToRedeem" INTEGER NOT NULL DEFAULT 0,
    "accumulatedOrder" INTEGER,
    "TID" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "GuperTransaction_cartToken_key" ON "GuperTransaction"("cartToken");

-- CreateIndex
CREATE UNIQUE INDEX "GuperTransaction_shopifyOrderId_key" ON "GuperTransaction"("shopifyOrderId");

-- CreateIndex
CREATE INDEX "GuperTransaction_shopifyOrderId_idx" ON "GuperTransaction"("shopifyOrderId");

-- CreateIndex
CREATE INDEX "GuperTransaction_status_idx" ON "GuperTransaction"("status");
