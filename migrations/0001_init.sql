-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT,
    "passwordHash" TEXT NOT NULL,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "trialStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialEndsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "customFeatures" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "accounts_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL NOT NULL DEFAULT 0.00,
    "renewalPrice" DECIMAL NOT NULL DEFAULT 0.00,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "validityDays" INTEGER NOT NULL DEFAULT 365,
    "companyLimit" INTEGER NOT NULL DEFAULT 1,
    "userLimit" INTEGER NOT NULL DEFAULT 5,
    "trialEligible" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "features" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'CORE',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "plan_features" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "plan_features_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "plan_features_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "features" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "amountPaid" DECIMAL NOT NULL DEFAULT 0.00,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gateway" TEXT,
    "paymentReference" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_subscriptions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "account_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "localDescription" TEXT,
    "address" TEXT,
    "city" TEXT,
    "pincode" TEXT,
    "stateId" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "website" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "taxId" TEXT,
    "fssaiNo" TEXT,
    "drugLicenseNo" TEXT,
    "defaultTaxMode" TEXT NOT NULL DEFAULT 'TAX_EXCLUSIVE',
    "posEnableTax" BOOLEAN NOT NULL DEFAULT true,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "currencySymbol" TEXT NOT NULL DEFAULT '₹',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "numberFormat" TEXT NOT NULL DEFAULT 'en-IN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "companies_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "companies_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "companies_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "company_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MANAGER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "company_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "currencySymbol" TEXT NOT NULL DEFAULT '₹',
    "phoneCode" TEXT NOT NULL DEFAULT '91',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stateCodeGst" TEXT,
    "isUt" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "states_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tax_systems" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tax_systems_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tax_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxSystemId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "tax_types_taxSystemId_fkey" FOREIGN KEY ("taxSystemId") REFERENCES "tax_systems" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxSystemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" DATETIME,
    CONSTRAINT "tax_rates_taxSystemId_fkey" FOREIGN KEY ("taxSystemId") REFERENCES "tax_systems" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tax_rate_components" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxRateId" TEXT NOT NULL,
    "taxTypeId" TEXT NOT NULL,
    "ratePercentage" DECIMAL NOT NULL,
    CONSTRAINT "tax_rate_components_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tax_rate_components_taxTypeId_fkey" FOREIGN KEY ("taxTypeId") REFERENCES "tax_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "financial_years" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" DATETIME,
    "closedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_years_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "financial_year_closings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "financialYearId" TEXT NOT NULL,
    "snapshotData" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_year_closings_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "financial_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "party_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "party_groups_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "parties" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "partyGroupId" TEXT,
    "partyType" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "taxId" TEXT,
    "gstRegType" TEXT NOT NULL DEFAULT 'UNREGISTERED',
    "stateId" TEXT,
    "city" TEXT,
    "pincode" TEXT,
    "billingAddress" TEXT,
    "shippingAddress" TEXT,
    "creditLimit" DECIMAL NOT NULL DEFAULT 0.00,
    "openingBalance" DECIMAL NOT NULL DEFAULT 0.00,
    "openingBalanceType" TEXT NOT NULL DEFAULT 'DEBIT',
    "isWalkIn" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "parties_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "parties_partyGroupId_fkey" FOREIGN KEY ("partyGroupId") REFERENCES "party_groups" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parties_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uqcCode" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "units_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "item_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "item_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "description" TEXT,
    "hsnSac" TEXT,
    "unitId" TEXT NOT NULL,
    "purchasePrice" DECIMAL NOT NULL DEFAULT 0.00,
    "salesPrice" DECIMAL NOT NULL DEFAULT 0.00,
    "mrp" DECIMAL NOT NULL DEFAULT 0.00,
    "taxRateId" TEXT,
    "cessRate" DECIMAL NOT NULL DEFAULT 0.0000,
    "discountRate" DECIMAL NOT NULL DEFAULT 0.0000,
    "minStockLevel" DECIMAL NOT NULL DEFAULT 0.0000,
    "reorderLevel" DECIMAL NOT NULL DEFAULT 0.0000,
    "openingStock" DECIMAL NOT NULL DEFAULT 0.0000,
    "openingStockValue" DECIMAL NOT NULL DEFAULT 0.00,
    "isService" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "items_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "item_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "items_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifsc" TEXT,
    "swift" TEXT,
    "branch" TEXT,
    "upiId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "salesmen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "employeeCode" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "address" TEXT,
    "commissionRate" DECIMAL NOT NULL DEFAULT 0.0000,
    "pointsPerAmount" DECIMAL NOT NULL DEFAULT 0.0000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "salesmen_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "salesmen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "salesman_points_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "salesmanId" TEXT NOT NULL,
    "documentId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'CREDIT',
    "points" DECIMAL NOT NULL,
    "amount" DECIMAL NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "salesman_points_transactions_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "salesmen" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "salesman_points_transactions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loyalty_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "currentPoints" DECIMAL NOT NULL DEFAULT 0.00,
    "totalEarned" DECIMAL NOT NULL DEFAULT 0.00,
    "totalRedeemed" DECIMAL NOT NULL DEFAULT 0.00,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "loyalty_accounts_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loyalty_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loyaltyAccountId" TEXT NOT NULL,
    "documentId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'CREDIT',
    "points" DECIMAL NOT NULL,
    "redemptionAmount" DECIMAL NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_transactions_loyaltyAccountId_fkey" FOREIGN KEY ("loyaltyAccountId") REFERENCES "loyalty_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loyalty_transactions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "document_series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "document_series_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "document_series_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "financial_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "documentDate" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "partyId" TEXT,
    "billingPartyName" TEXT,
    "billingAddress" TEXT,
    "billingStateId" TEXT,
    "billingGstin" TEXT,
    "shippingAddress" TEXT,
    "shippingStateId" TEXT,
    "placeOfSupplyStateId" TEXT,
    "reverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "taxMode" TEXT NOT NULL DEFAULT 'TAX_EXCLUSIVE',
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "exchangeRate" DECIMAL NOT NULL DEFAULT 1.0000,
    "subTotal" DECIMAL NOT NULL DEFAULT 0.00,
    "taxTotal" DECIMAL NOT NULL DEFAULT 0.00,
    "discountTotal" DECIMAL NOT NULL DEFAULT 0.00,
    "freightCharges" DECIMAL NOT NULL DEFAULT 0.00,
    "packingCharges" DECIMAL NOT NULL DEFAULT 0.00,
    "otherCharges" DECIMAL NOT NULL DEFAULT 0.00,
    "roundOff" DECIMAL NOT NULL DEFAULT 0.00,
    "grandTotal" DECIMAL NOT NULL DEFAULT 0.00,
    "paidAmount" DECIMAL NOT NULL DEFAULT 0.00,
    "balanceAmount" DECIMAL NOT NULL DEFAULT 0.00,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "salesmanId" TEXT,
    "notes" TEXT,
    "termsConditions" TEXT,
    "createdByUserId" TEXT,
    "cancelledAt" DATETIME,
    "cancelledReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "financial_years" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "documents_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "documents_billingStateId_fkey" FOREIGN KEY ("billingStateId") REFERENCES "states" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_shippingStateId_fkey" FOREIGN KEY ("shippingStateId") REFERENCES "states" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_placeOfSupplyStateId_fkey" FOREIGN KEY ("placeOfSupplyStateId") REFERENCES "states" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "salesmen" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "document_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "itemId" TEXT,
    "itemName" TEXT NOT NULL,
    "hsnSac" TEXT,
    "quantity" DECIMAL NOT NULL,
    "unitName" TEXT,
    "unitRate" DECIMAL NOT NULL,
    "grossAmount" DECIMAL NOT NULL,
    "discountRate" DECIMAL NOT NULL DEFAULT 0.0000,
    "discountAmount" DECIMAL NOT NULL DEFAULT 0.00,
    "taxableAmount" DECIMAL NOT NULL,
    "taxRateId" TEXT,
    "taxPercentage" DECIMAL NOT NULL DEFAULT 0.0000,
    "taxAmount" DECIMAL NOT NULL DEFAULT 0.00,
    "cessRate" DECIMAL NOT NULL DEFAULT 0.0000,
    "cessAmount" DECIMAL NOT NULL DEFAULT 0.00,
    "totalAmount" DECIMAL NOT NULL,
    CONSTRAINT "document_items_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "document_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "document_taxes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "taxTypeCode" TEXT NOT NULL,
    "taxRatePercentage" DECIMAL NOT NULL,
    "taxableAmount" DECIMAL NOT NULL,
    "taxAmount" DECIMAL NOT NULL,
    CONSTRAINT "document_taxes_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "document_transport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "transporterName" TEXT,
    "transporterId" TEXT,
    "vehicleNumber" TEXT,
    "lrNumber" TEXT,
    "lrDate" DATETIME,
    "distanceKm" INTEGER,
    "transportMode" TEXT,
    "ewayBillNumber" TEXT,
    "ewayBillDate" DATETIME,
    CONSTRAINT "document_transport_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "document_exports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "exportType" TEXT NOT NULL DEFAULT 'WITHOUT_PAYMENT_OF_TAX_UNDER_LUT',
    "lutNumber" TEXT,
    "portCode" TEXT,
    "shippingBillNumber" TEXT,
    "shippingBillDate" DATETIME,
    "foreignCurrencyCode" TEXT DEFAULT 'USD',
    "exchangeRate" DECIMAL NOT NULL DEFAULT 1.0000,
    "foreignAmount" DECIMAL NOT NULL DEFAULT 0.00,
    CONSTRAINT "document_exports_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "document_references" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "referencedDocumentId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL DEFAULT 'REFERENCE',
    CONSTRAINT "document_references_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "document_references_referencedDocumentId_fkey" FOREIGN KEY ("referencedDocumentId") REFERENCES "documents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "partyId" TEXT,
    "documentId" TEXT,
    "paymentId" TEXT,
    "entryDate" DATETIME NOT NULL,
    "accountHead" TEXT NOT NULL DEFAULT 'GENERAL',
    "debit" DECIMAL NOT NULL DEFAULT 0.00,
    "credit" DECIMAL NOT NULL DEFAULT 0.00,
    "narration" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ledger_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ledger_entries_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "financial_years" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ledger_entries_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ledger_entries_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ledger_entries_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL DEFAULT 'IN_RECEIPT',
    "paymentNumber" TEXT NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "partyId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'CASH',
    "bankAccountId" TEXT,
    "referenceNumber" TEXT,
    "chequeNumber" TEXT,
    "notes" TEXT,
    "attachmentUrl" TEXT,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payments_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "financial_years" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payments_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "allocatedAmount" DECIMAL NOT NULL,
    CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_allocations_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "documentId" TEXT,
    "movementType" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "unitRate" DECIMAL NOT NULL DEFAULT 0.00,
    "totalValue" DECIMAL NOT NULL DEFAULT 0.00,
    "movementDate" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_movements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "financial_years" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "document_deliveries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "errorMessage" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_deliveries_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "client_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "mobile" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "client_users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_users_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "client_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "clientUserId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "orderType" TEXT NOT NULL DEFAULT 'ORGANIZED',
    "status" TEXT NOT NULL DEFAULT 'PLACED',
    "notes" TEXT,
    "subTotal" DECIMAL NOT NULL DEFAULT 0.00,
    "taxTotal" DECIMAL NOT NULL DEFAULT 0.00,
    "grandTotal" DECIMAL NOT NULL DEFAULT 0.00,
    "documentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "client_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_orders_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "client_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_orders_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "client_orders_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "client_order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT,
    "itemName" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "unitName" TEXT,
    "unitRate" DECIMAL NOT NULL,
    "taxRate" DECIMAL NOT NULL DEFAULT 0.0000,
    "taxAmount" DECIMAL NOT NULL DEFAULT 0.00,
    "totalAmount" DECIMAL NOT NULL,
    "notes" TEXT,
    "attachmentUrl" TEXT,
    CONSTRAINT "client_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "client_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_order_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "client_order_attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "fileType" TEXT NOT NULL DEFAULT 'IMAGE',
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "fileSize" INTEGER,
    "durationSec" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_order_attachments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "client_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "accounts_ownerUserId_idx" ON "accounts"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "features_code_key" ON "features"("code");

-- CreateIndex
CREATE UNIQUE INDEX "plan_features_planId_featureId_key" ON "plan_features"("planId", "featureId");

-- CreateIndex
CREATE INDEX "account_subscriptions_accountId_idx" ON "account_subscriptions"("accountId");

-- CreateIndex
CREATE INDEX "companies_accountId_idx" ON "companies"("accountId");

-- CreateIndex
CREATE INDEX "companies_gstin_idx" ON "companies"("gstin");

-- CreateIndex
CREATE INDEX "company_users_userId_idx" ON "company_users"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "company_users_companyId_userId_key" ON "company_users"("companyId", "userId");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_idx" ON "audit_logs"("companyId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");

-- CreateIndex
CREATE INDEX "states_stateCodeGst_idx" ON "states"("stateCodeGst");

-- CreateIndex
CREATE UNIQUE INDEX "states_countryId_code_key" ON "states"("countryId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "tax_systems_code_key" ON "tax_systems"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tax_types_taxSystemId_code_key" ON "tax_types"("taxSystemId", "code");

-- CreateIndex
CREATE INDEX "tax_rates_taxSystemId_idx" ON "tax_rates"("taxSystemId");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rate_components_taxRateId_taxTypeId_key" ON "tax_rate_components"("taxRateId", "taxTypeId");

-- CreateIndex
CREATE INDEX "financial_years_companyId_isClosed_idx" ON "financial_years"("companyId", "isClosed");

-- CreateIndex
CREATE UNIQUE INDEX "financial_years_companyId_name_key" ON "financial_years"("companyId", "name");

-- CreateIndex
CREATE INDEX "financial_year_closings_financialYearId_idx" ON "financial_year_closings"("financialYearId");

-- CreateIndex
CREATE UNIQUE INDEX "party_groups_companyId_name_key" ON "party_groups"("companyId", "name");

-- CreateIndex
CREATE INDEX "parties_companyId_partyType_idx" ON "parties"("companyId", "partyType");

-- CreateIndex
CREATE INDEX "parties_companyId_gstin_idx" ON "parties"("companyId", "gstin");

-- CreateIndex
CREATE UNIQUE INDEX "units_companyId_code_key" ON "units"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "item_categories_companyId_name_key" ON "item_categories"("companyId", "name");

-- CreateIndex
CREATE INDEX "items_companyId_sku_idx" ON "items"("companyId", "sku");

-- CreateIndex
CREATE INDEX "items_companyId_barcode_idx" ON "items"("companyId", "barcode");

-- CreateIndex
CREATE INDEX "items_companyId_hsnSac_idx" ON "items"("companyId", "hsnSac");

-- CreateIndex
CREATE INDEX "bank_accounts_companyId_idx" ON "bank_accounts"("companyId");

-- CreateIndex
CREATE INDEX "salesmen_companyId_idx" ON "salesmen"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "salesmen_companyId_employeeCode_key" ON "salesmen"("companyId", "employeeCode");

-- CreateIndex
CREATE INDEX "salesman_points_transactions_salesmanId_idx" ON "salesman_points_transactions"("salesmanId");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_accounts_partyId_key" ON "loyalty_accounts"("partyId");

-- CreateIndex
CREATE INDEX "loyalty_transactions_loyaltyAccountId_idx" ON "loyalty_transactions"("loyaltyAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "document_series_companyId_financialYearId_documentType_prefix_key" ON "document_series"("companyId", "financialYearId", "documentType", "prefix");

-- CreateIndex
CREATE INDEX "documents_companyId_documentType_documentDate_idx" ON "documents"("companyId", "documentType", "documentDate");

-- CreateIndex
CREATE INDEX "documents_partyId_idx" ON "documents"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_companyId_financialYearId_documentType_documentNumber_key" ON "documents"("companyId", "financialYearId", "documentType", "documentNumber");

-- CreateIndex
CREATE INDEX "document_items_documentId_idx" ON "document_items"("documentId");

-- CreateIndex
CREATE INDEX "document_taxes_documentId_idx" ON "document_taxes"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "document_transport_documentId_key" ON "document_transport"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "document_exports_documentId_key" ON "document_exports"("documentId");

-- CreateIndex
CREATE INDEX "document_references_documentId_idx" ON "document_references"("documentId");

-- CreateIndex
CREATE INDEX "document_references_referencedDocumentId_idx" ON "document_references"("referencedDocumentId");

-- CreateIndex
CREATE INDEX "ledger_entries_companyId_entryDate_idx" ON "ledger_entries"("companyId", "entryDate");

-- CreateIndex
CREATE INDEX "ledger_entries_companyId_partyId_entryDate_idx" ON "ledger_entries"("companyId", "partyId", "entryDate");

-- CreateIndex
CREATE INDEX "payments_companyId_paymentDate_idx" ON "payments"("companyId", "paymentDate");

-- CreateIndex
CREATE INDEX "payments_partyId_idx" ON "payments"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_companyId_financialYearId_paymentNumber_key" ON "payments"("companyId", "financialYearId", "paymentNumber");

-- CreateIndex
CREATE INDEX "payment_allocations_paymentId_idx" ON "payment_allocations"("paymentId");

-- CreateIndex
CREATE INDEX "payment_allocations_documentId_idx" ON "payment_allocations"("documentId");

-- CreateIndex
CREATE INDEX "stock_movements_companyId_itemId_movementDate_idx" ON "stock_movements"("companyId", "itemId", "movementDate");

-- CreateIndex
CREATE INDEX "document_deliveries_documentId_idx" ON "document_deliveries"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "client_users_partyId_key" ON "client_users"("partyId");

-- CreateIndex
CREATE INDEX "client_users_companyId_idx" ON "client_users"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "client_users_companyId_mobile_key" ON "client_users"("companyId", "mobile");

-- CreateIndex
CREATE INDEX "client_orders_companyId_status_idx" ON "client_orders"("companyId", "status");

-- CreateIndex
CREATE INDEX "client_orders_partyId_idx" ON "client_orders"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "client_orders_companyId_orderNumber_key" ON "client_orders"("companyId", "orderNumber");

-- CreateIndex
CREATE INDEX "client_order_items_orderId_idx" ON "client_order_items"("orderId");

-- CreateIndex
CREATE INDEX "client_order_attachments_orderId_idx" ON "client_order_attachments"("orderId");

