-- CreateTable
CREATE TABLE "receipt_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paperSize" TEXT NOT NULL DEFAULT '80mm',
    "autoPrint" BOOLEAN NOT NULL DEFAULT true,
    "showBusinessLogo" BOOLEAN NOT NULL DEFAULT true,
    "showCashier" BOOLEAN NOT NULL DEFAULT true,
    "showCustomer" BOOLEAN NOT NULL DEFAULT true,
    "showSku" BOOLEAN NOT NULL DEFAULT true,
    "showTax" BOOLEAN NOT NULL DEFAULT true,
    "showDiscount" BOOLEAN NOT NULL DEFAULT true,
    "showPaymentReference" BOOLEAN NOT NULL DEFAULT true,
    "footerMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "receipt_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "dashboard" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receipt_settings_organizationId_key" ON "receipt_settings"("organizationId");
CREATE UNIQUE INDEX "notification_settings_organizationId_eventKey_key" ON "notification_settings"("organizationId", "eventKey");
CREATE INDEX "notification_settings_organizationId_idx" ON "notification_settings"("organizationId");

-- AddForeignKey
ALTER TABLE "receipt_settings" ADD CONSTRAINT "receipt_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
