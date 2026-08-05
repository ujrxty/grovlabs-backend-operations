-- CreateTable
CREATE TABLE "campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "call_type" TEXT NOT NULL,
    "description" TEXT,
    "payout" DECIMAL(10,2) NOT NULL,
    "payout_type" TEXT NOT NULL,
    "billing_cycle" TEXT NOT NULL DEFAULT 'weekly',
    "min_duration" INTEGER,
    "geographic_focus" TEXT,
    "allowed_traffic" TEXT,
    "restricted_traffic" TEXT,
    "requirements" TEXT,
    "compliance_notes" TEXT,
    "terms_template" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "payout_display" TEXT,

    CONSTRAINT "campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_application" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "website" TEXT,
    "traffic_types" TEXT NOT NULL,
    "estimated_volume" TEXT,
    "experience" TEXT,
    "referred_by" TEXT,
    "comments" TEXT,
    "company_address" TEXT,
    "company_state" TEXT,
    "company_country" TEXT,
    "entity_type" TEXT,
    "campaign_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "status_reason" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "tcpa_agreed" BOOLEAN NOT NULL DEFAULT false,
    "terms_agreed" BOOLEAN NOT NULL DEFAULT false,
    "agreed_ip" TEXT,
    "agreed_at" TIMESTAMP(3),
    "status_token" TEXT NOT NULL,
    "group_token" TEXT,
    "vendor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_profile" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "website" TEXT,
    "company_address" TEXT,
    "company_state" TEXT,
    "company_country" TEXT,
    "entity_type" TEXT,
    "td_source_id" TEXT,
    "td_source_name" TEXT,
    "td_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insertion_order" (
    "id" TEXT NOT NULL,
    "io_number" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "payout" DECIMAL(10,2) NOT NULL,
    "payout_type" TEXT NOT NULL,
    "billing_cycle" TEXT NOT NULL,
    "min_duration" INTEGER,
    "terms" TEXT NOT NULL,
    "special_terms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_vendor',
    "sign_token" TEXT NOT NULL,
    "vendor_signed_at" TIMESTAMP(3),
    "vendor_sign_name" TEXT,
    "vendor_sign_ip" TEXT,
    "counter_signed_at" TIMESTAMP(3),
    "counter_sign_by" TEXT,
    "effective_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "campaign_ids" TEXT,

    CONSTRAINT "insertion_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_purchase_agreement" (
    "id" TEXT NOT NULL,
    "io_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "agreement_text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_vendor',
    "sign_token" TEXT NOT NULL,
    "vendor_signed_at" TIMESTAMP(3),
    "vendor_sign_name" TEXT,
    "vendor_sign_ip" TEXT,
    "counter_signed_at" TIMESTAMP(3),
    "counter_sign_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_purchase_agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "io_counter" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "year" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "io_counter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaign_name_key" ON "campaign"("name");

-- CreateIndex
CREATE INDEX "campaign_industry_idx" ON "campaign"("industry");

-- CreateIndex
CREATE INDEX "campaign_is_active_idx" ON "campaign"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_application_status_token_key" ON "vendor_application"("status_token");

-- CreateIndex
CREATE INDEX "vendor_application_email_idx" ON "vendor_application"("email");

-- CreateIndex
CREATE INDEX "vendor_application_status_idx" ON "vendor_application"("status");

-- CreateIndex
CREATE INDEX "vendor_application_status_token_idx" ON "vendor_application"("status_token");

-- CreateIndex
CREATE INDEX "vendor_application_group_token_idx" ON "vendor_application"("group_token");

-- CreateIndex
CREATE INDEX "vendor_application_campaign_id_idx" ON "vendor_application"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_profile_email_key" ON "vendor_profile"("email");

-- CreateIndex
CREATE INDEX "vendor_profile_email_idx" ON "vendor_profile"("email");

-- CreateIndex
CREATE INDEX "vendor_profile_status_idx" ON "vendor_profile"("status");

-- CreateIndex
CREATE UNIQUE INDEX "insertion_order_io_number_key" ON "insertion_order"("io_number");

-- CreateIndex
CREATE UNIQUE INDEX "insertion_order_sign_token_key" ON "insertion_order"("sign_token");

-- CreateIndex
CREATE INDEX "insertion_order_vendor_id_idx" ON "insertion_order"("vendor_id");

-- CreateIndex
CREATE INDEX "insertion_order_io_number_idx" ON "insertion_order"("io_number");

-- CreateIndex
CREATE INDEX "insertion_order_sign_token_idx" ON "insertion_order"("sign_token");

-- CreateIndex
CREATE INDEX "insertion_order_status_idx" ON "insertion_order"("status");

-- CreateIndex
CREATE UNIQUE INDEX "lead_purchase_agreement_sign_token_key" ON "lead_purchase_agreement"("sign_token");

-- CreateIndex
CREATE INDEX "lead_purchase_agreement_io_id_idx" ON "lead_purchase_agreement"("io_id");

-- CreateIndex
CREATE INDEX "lead_purchase_agreement_vendor_id_idx" ON "lead_purchase_agreement"("vendor_id");

-- CreateIndex
CREATE INDEX "lead_purchase_agreement_sign_token_idx" ON "lead_purchase_agreement"("sign_token");

-- CreateIndex
CREATE INDEX "lead_purchase_agreement_status_idx" ON "lead_purchase_agreement"("status");

-- AddForeignKey
ALTER TABLE "vendor_application" ADD CONSTRAINT "vendor_application_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_application" ADD CONSTRAINT "vendor_application_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insertion_order" ADD CONSTRAINT "insertion_order_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insertion_order" ADD CONSTRAINT "insertion_order_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_purchase_agreement" ADD CONSTRAINT "lead_purchase_agreement_io_id_fkey" FOREIGN KEY ("io_id") REFERENCES "insertion_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_purchase_agreement" ADD CONSTRAINT "lead_purchase_agreement_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
