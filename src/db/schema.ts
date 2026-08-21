import { runMigrations } from "./migrations";
import { legacySchemaBaselineMigration } from "./migrations/000_legacy_baseline";
import { leadProvenanceMigration } from "./migrations/001_lead_provenance";
import { normalizedLeadAttributesMigration } from "./migrations/002_normalized_lead_attributes";
import { scoreBreakdownMigration } from "./migrations/003_score_breakdown";
import { emailVerificationMigration } from "./migrations/004_email_verification";
import { leadOptOutMigration } from "./migrations/005_lead_opt_out";
import { draftGenerationContextMigration } from "./migrations/006_draft_generation_context";
import { productProfilesMigration } from "./migrations/007_product_profiles";
import { productOffersMigration } from "./migrations/008_product_offers";
import { campaignSendPolicyMigration } from "./migrations/009_campaign_send_policy";
import { providerAuditEventsMigration } from "./migrations/010_provider_audit_events";
import { emailDeliveryTrackingMigration } from "./migrations/011_email_delivery_tracking";
import { leadDeduplicationIndexesMigration } from "./migrations/012_lead_deduplication_indexes";
import { businessMaterialsMigration } from "./migrations/013_business_materials";
import { campaignExactScheduleMigration } from "./migrations/014_campaign_exact_schedule";

/** Applies ordered, versioned schema migrations before request processing begins. */
export async function initDb(): Promise<void> {
  await runMigrations([
    legacySchemaBaselineMigration,
    leadProvenanceMigration,
    normalizedLeadAttributesMigration,
    scoreBreakdownMigration,
    emailVerificationMigration,
    leadOptOutMigration,
    draftGenerationContextMigration,
    productProfilesMigration,
    productOffersMigration,
    campaignSendPolicyMigration,
    providerAuditEventsMigration,
    emailDeliveryTrackingMigration,
    leadDeduplicationIndexesMigration,
    businessMaterialsMigration,
    campaignExactScheduleMigration,
  ]);
}
