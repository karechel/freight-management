#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3277325397aec2a66c498a80377ddeeeee51528527b3b4c6864dd3167eb01cdc/contract';
import endContract from '../../snapshots/3277325397aec2a66c498a80377ddeeeee51528527b3b4c6864dd3167eb01cdc/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/a9d7a84912b737e8581830dda6bf513a0dd0b4a9ea8dc2a767998a2215d88963/contract';
import startContract from '../../snapshots/a9d7a84912b737e8581830dda6bf513a0dd0b4a9ea8dc2a767998a2215d88963/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'AuditLog',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actorUserId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('changes', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('entityId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('entityType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('occurredAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('summary', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Booking',
        columns: [
          col('agentId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('cancellationReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('cancelledAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('cargoSummary', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('carrierBookingNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('carrierId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('confirmedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('createdById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('customerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('destination', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('direction', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('mode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('origin', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('plannedEta', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('plannedEtd', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('quotationId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('reference', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Booking_direction_check_8057d484',
            "\"direction\" IN ('import', 'export', 'transit')",
          ),
          checkExpression(
            'Booking_mode_check_6b0005c5',
            "\"mode\" IN ('sea', 'air', 'road', 'rail')",
          ),
          checkExpression(
            'Booking_status_check_e791946a',
            "\"status\" IN ('pending', 'confirmed', 'completed', 'cancelled')",
          ),
          checkExpression(
            'booking_cancelled_has_time_dd67e027',
            'status <> \'cancelled\' OR "cancelledAt" IS NOT NULL',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'ChargeType',
        columns: [
          col('category', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('defaultTaxCategory', 'text', {
            notNull: true,
            default: lit('standard'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('defaultTaxRate', 'numeric(5,2)', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('isDisbursement', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ChargeType_category_check_5c2cbcfb',
            "\"category\" IN ('service_fee', 'carrier', 'transport', 'handling', 'storage', 'customs', 'agent_fees', 'other')",
          ),
          checkExpression(
            'ChargeType_defaultTaxCategory_check_68edd728',
            "\"defaultTaxCategory\" IN ('standard', 'zero_rated', 'exempt', 'outside_vat')",
          ),
          checkExpression(
            'charge_type_tax_rate_range_2e03130e',
            '"defaultTaxRate" >= 0 AND "defaultTaxRate" <= 100',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Contact',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isPrimary', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('partyId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Container',
        columns: [
          col('containerNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('grossWeightKg', 'numeric(12,3)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 12, scale: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('packages', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('sealNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('shipmentId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Container_type_check_b6211f79',
            "\"type\" IN ('dry_20', 'dry_40', 'high_cube_40', 'reefer_20', 'reefer_40', 'open_top', 'flat_rack', 'other')",
          ),
          checkExpression(
            'container_number_format_bc73fe4a',
            '"containerNumber" ~ \'^[A-Z]{4}[0-9]{7}$\'',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'CreditCheck',
        columns: [
          col('attemptedAmount', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('bookingId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('creditLimit', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('customerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('decidedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('decidedById', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('decision', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('exposure', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('invoiceId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'CreditCheck_decision_check_9088aba5',
            "\"decision\" IN ('proceed', 'blocked')",
          ),
          checkExpression('credit_check_reason_required_cf4bb0de', 'length(btrim(reason)) > 0'),
          checkExpression(
            'credit_check_single_subject_94a1bf1a',
            'num_nonnulls("bookingId", "invoiceId") <= 1',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'CreditNote',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('createdById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('etimsReference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('etimsStatus', 'text', {
            notNull: true,
            default: lit('not_submitted'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('etimsSubmittedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('invoiceId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('issueDate', '"date"', { codecRef: { codecId: 'pg/date-string@1', typeParams: {} } }),
          col('issuedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('issuedById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('number', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('draft'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('subtotal', 'numeric(14,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('taxTotal', 'numeric(14,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('total', 'numeric(14,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'CreditNote_etimsStatus_check_4b7f16e9',
            "\"etimsStatus\" IN ('not_submitted', 'submitted', 'accepted', 'rejected')",
          ),
          checkExpression(
            'CreditNote_status_check_aafcd370',
            "\"status\" IN ('draft', 'issued', 'cancelled')",
          ),
          checkExpression(
            'credit_note_issued_fields_b0970157',
            'status <> \'issued\' OR ("issueDate" IS NOT NULL AND subtotal IS NOT NULL AND "taxTotal" IS NOT NULL AND total IS NOT NULL AND "issuedAt" IS NOT NULL)',
          ),
          checkExpression(
            'credit_note_totals_consistent_3f8bc039',
            'total IS NULL OR (subtotal >= 0 AND "taxTotal" >= 0 AND total = subtotal + "taxTotal")',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'CreditNoteLine',
        columns: [
          col('creditNoteId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('invoiceLineId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('quantity', 'numeric(12,3)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 12, scale: 3 } },
          }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('taxCategory', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('taxRate', 'numeric(5,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('unitPrice', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'CreditNoteLine_taxCategory_check_5572e5ab',
            "\"taxCategory\" IN ('standard', 'zero_rated', 'exempt', 'outside_vat')",
          ),
          checkExpression(
            'credit_note_line_amounts_fd82e6b1',
            'quantity > 0 AND "unitPrice" >= 0 AND "taxRate" >= 0 AND "taxRate" <= 100',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'CustomsCharge',
        columns: [
          col('amount', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('chargeTypeId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('customsEntryId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('paidAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('paidBy', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('paymentReference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'CustomsCharge_paidBy_check_738844b2',
            "\"paidBy\" IN ('company', 'customer')",
          ),
          checkExpression('customs_charge_amount_non_negative_2ce36fec', 'amount >= 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'CustomsEntry',
        columns: [
          col('assessedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('createdById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('customsStation', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('declarationNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('legalHold', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('legalHoldReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lodgedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('queryDetails', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reference', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('regime', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('releaseOrderNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('releasedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('shipmentId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('not_started'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'CustomsEntry_regime_check_0f7f0979',
            "\"regime\" IN ('import_home_use', 'transit', 'export', 're_export', 'temporary_import', 'other')",
          ),
          checkExpression(
            'CustomsEntry_status_check_7164e2d0',
            "\"status\" IN ('not_started', 'documents_pending', 'lodged', 'assessed', 'duty_paid', 'released', 'query')",
          ),
          checkExpression(
            'customs_legal_hold_reason_669410db',
            'NOT "legalHold" OR "legalHoldReason" IS NOT NULL',
          ),
          checkExpression(
            'customs_released_has_time_bb0dcb7d',
            'status <> \'released\' OR "releasedAt" IS NOT NULL',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Document',
        columns: [
          col('bookingId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('category', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('customerVisible', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('customsEntryId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('deletedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('documentNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('expiresOn', '"date"', { codecRef: { codecId: 'pg/date-string@1', typeParams: {} } }),
          col('fileName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('invoiceId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('issueDate', '"date"', { codecRef: { codecId: 'pg/date-string@1', typeParams: {} } }),
          col('legalHold', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('legalHoldReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('mimeType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('originalLocation', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('originalReleasedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('originalReleasedTo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('originalStatus', 'text', {
            notNull: true,
            default: lit('none'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('partyId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('quotationId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('receivedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('rejectionReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reviewedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('reviewedById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('sha256', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('shipmentId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('sizeBytes', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('missing'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('storageKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('uploadedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('uploadedById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Document_category_check_edaf5cef',
            "\"category\" IN ('operational', 'financial', 'customs')",
          ),
          checkExpression(
            'Document_originalStatus_check_d384b603',
            "\"originalStatus\" IN ('none', 'held', 'released', 'returned')",
          ),
          checkExpression(
            'Document_status_check_4192b929',
            "\"status\" IN ('missing', 'received', 'verified', 'rejected')",
          ),
          checkExpression(
            'Document_type_check_70fffa4e',
            "\"type\" IN ('bill_of_lading', 'air_waybill', 'road_consignment_note', 'packing_list', 'commercial_invoice', 'certificate_of_origin', 'import_declaration_form', 'release_order', 'permit', 'proof_of_delivery', 'other')",
          ),
          checkExpression(
            'document_file_fields_together_a02c9994',
            '("storageKey" IS NULL) = ("fileName" IS NULL) AND ("storageKey" IS NULL) = ("mimeType" IS NULL) AND ("storageKey" IS NULL) = ("sizeBytes" IS NULL)',
          ),
          checkExpression(
            'document_has_link_a4eb4dbc',
            'num_nonnulls("partyId", "quotationId", "bookingId", "shipmentId", "customsEntryId", "invoiceId") >= 1',
          ),
          checkExpression(
            'document_legal_hold_reason_669410db',
            'NOT "legalHold" OR "legalHoldReason" IS NOT NULL',
          ),
          checkExpression(
            'document_rejected_has_reason_d75d89fc',
            'status <> \'rejected\' OR "rejectionReason" IS NOT NULL',
          ),
          checkExpression(
            'document_sha256_format_8058bee8',
            "sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'",
          ),
          checkExpression(
            'document_size_positive_9dce0af3',
            '"sizeBytes" IS NULL OR "sizeBytes" > 0',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Expense',
        columns: [
          col('amount', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('approvedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('approvedById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('billable', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('chargeTypeId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('customsChargeId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('incurredOn', '"date"', {
            notNull: true,
            codecRef: { codecId: 'pg/date-string@1', typeParams: {} },
          }),
          col('invoiceLineId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('paidAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('payeeName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('paymentReference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('recordedById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('shipmentId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending_approval'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('supplierId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('supplierInvoiceNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('transportJobId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Expense_status_check_9d117c36',
            "\"status\" IN ('pending_approval', 'approved', 'paid')",
          ),
          checkExpression('expense_amount_positive_2612d8b9', 'amount > 0'),
          checkExpression(
            'expense_approved_fields_a5341227',
            'status = \'pending_approval\' OR ("approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL)',
          ),
          checkExpression(
            'expense_has_payee_0a21766a',
            'num_nonnulls("supplierId", "payeeName") >= 1',
          ),
          checkExpression(
            'expense_paid_has_time_841e9c5a',
            'status <> \'paid\' OR "paidAt" IS NOT NULL',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Invoice',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('createdById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('customerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('customerKraPin', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('customerName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('dueDate', '"date"', { codecRef: { codecId: 'pg/date-string@1', typeParams: {} } }),
          col('etimsReference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('etimsStatus', 'text', {
            notNull: true,
            default: lit('not_submitted'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('etimsSubmittedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('issueDate', '"date"', { codecRef: { codecId: 'pg/date-string@1', typeParams: {} } }),
          col('issuedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('issuedById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('legalHold', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('legalHoldReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('number', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('shipmentId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('draft'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('subtotal', 'numeric(14,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('taxTotal', 'numeric(14,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('total', 'numeric(14,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Invoice_etimsStatus_check_4b7f16e9',
            "\"etimsStatus\" IN ('not_submitted', 'submitted', 'accepted', 'rejected')",
          ),
          checkExpression(
            'Invoice_status_check_aafcd370',
            "\"status\" IN ('draft', 'issued', 'cancelled')",
          ),
          checkExpression(
            'invoice_due_after_issue_5c6bbc10',
            '"dueDate" IS NULL OR "issueDate" IS NULL OR "dueDate" >= "issueDate"',
          ),
          checkExpression(
            'invoice_issued_fields_b5be5aa2',
            'status <> \'issued\' OR ("issueDate" IS NOT NULL AND "dueDate" IS NOT NULL AND "customerName" IS NOT NULL AND subtotal IS NOT NULL AND "taxTotal" IS NOT NULL AND total IS NOT NULL AND "issuedAt" IS NOT NULL)',
          ),
          checkExpression(
            'invoice_legal_hold_reason_669410db',
            'NOT "legalHold" OR "legalHoldReason" IS NOT NULL',
          ),
          checkExpression(
            'invoice_totals_consistent_3f8bc039',
            'total IS NULL OR (subtotal >= 0 AND "taxTotal" >= 0 AND total = subtotal + "taxTotal")',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'InvoiceLine',
        columns: [
          col('chargeTypeId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('invoiceId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isDisbursement', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('quantity', 'numeric(12,3)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 12, scale: 3 } },
          }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('taxCategory', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('taxRate', 'numeric(5,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('unitPrice', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'InvoiceLine_taxCategory_check_5572e5ab',
            "\"taxCategory\" IN ('standard', 'zero_rated', 'exempt', 'outside_vat')",
          ),
          checkExpression(
            'invoice_line_amounts_fd82e6b1',
            'quantity > 0 AND "unitPrice" >= 0 AND "taxRate" >= 0 AND "taxRate" <= 100',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Note',
        columns: [
          col('authorId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('body', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isAutomatic', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('shipmentIssueId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('taskId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'note_single_parent_aea3c55b',
            'num_nonnulls("taskId", "shipmentIssueId") = 1',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'NumberSequence',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nextValue', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('prefix', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('year', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('number_sequence_next_positive_bbe83fe1', '"nextValue" >= 1'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Party',
        columns: [
          col('accountStatus', 'text', {
            notNull: true,
            default: lit('active'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('archivedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('city', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('country', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('createdById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('creditLimit', 'numeric(14,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('kraPin', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('legalName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('paymentTermsDays', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Party_accountStatus_check_078ba65a',
            "\"accountStatus\" IN ('active', 'on_hold', 'closed')",
          ),
          checkExpression(
            'party_credit_limit_non_negative_590a73e5',
            '"creditLimit" IS NULL OR "creditLimit" >= 0',
          ),
          checkExpression(
            'party_terms_non_negative_cfd059ff',
            '"paymentTermsDays" IS NULL OR "paymentTermsDays" >= 0',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'PartyRole',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('partyId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'PartyRole_role_check_17d40f4d',
            "\"role\" IN ('customer', 'agent', 'supplier', 'carrier', 'transporter')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Payment',
        columns: [
          col('amount', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('bounceReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('bouncedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('chequeBank', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('chequeDate', '"date"', {
            codecRef: { codecId: 'pg/date-string@1', typeParams: {} },
          }),
          col('chequeNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('clearedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('customerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('externalReference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('method', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('receivedAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('reconciledAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('reconciledById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('recordedById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('reference', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('received'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Payment_method_check_7a54e22c',
            "\"method\" IN ('cheque', 'bank_transfer')",
          ),
          checkExpression(
            'Payment_status_check_d4bbdb49',
            "\"status\" IN ('received', 'cleared', 'bounced', 'cancelled')",
          ),
          checkExpression('payment_amount_positive_2612d8b9', 'amount > 0'),
          checkExpression(
            'payment_bounced_has_time_b80af829',
            'status <> \'bounced\' OR "bouncedAt" IS NOT NULL',
          ),
          checkExpression(
            'payment_cheque_details_76b19fc5',
            'method <> \'cheque\' OR ("chequeNumber" IS NOT NULL AND "chequeBank" IS NOT NULL)',
          ),
          checkExpression(
            'payment_cleared_has_time_cb39359f',
            'status <> \'cleared\' OR "clearedAt" IS NOT NULL',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'PaymentAllocation',
        columns: [
          col('allocatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('allocatedById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('amount', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('invoiceId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('paymentId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('payment_allocation_amount_positive_2612d8b9', 'amount > 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Permission',
        columns: [
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Quotation',
        columns: [
          col('agentId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('cargoSummary', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('customerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('decidedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('destination', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('direction', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('duplicatedFromId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('grossWeightKg', 'numeric(12,3)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 12, scale: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('incoterm', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('internalNote', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('issueDate', '"date"', {
            notNull: true,
            codecRef: { codecId: 'pg/date-string@1', typeParams: {} },
          }),
          col('mode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('origin', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('packages', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('preparedById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('reference', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sentAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('sentTo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('draft'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('terms', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('validUntil', '"date"', {
            notNull: true,
            codecRef: { codecId: 'pg/date-string@1', typeParams: {} },
          }),
          col('volumeCbm', 'numeric(12,3)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 12, scale: 3 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Quotation_direction_check_8057d484',
            "\"direction\" IN ('import', 'export', 'transit')",
          ),
          checkExpression(
            'Quotation_mode_check_6b0005c5',
            "\"mode\" IN ('sea', 'air', 'road', 'rail')",
          ),
          checkExpression(
            'Quotation_status_check_8ee73f8c',
            "\"status\" IN ('draft', 'sent', 'accepted', 'declined', 'expired')",
          ),
          checkExpression('quotation_valid_after_issue_70204c1e', '"validUntil" >= "issueDate"'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'QuotationLine',
        columns: [
          col('chargeTypeId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('quantity', 'numeric(12,3)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 12, scale: 3 } },
          }),
          col('quotationId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('taxCategory', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('taxRate', 'numeric(5,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('unitPrice', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'QuotationLine_taxCategory_check_5572e5ab',
            "\"taxCategory\" IN ('standard', 'zero_rated', 'exempt', 'outside_vat')",
          ),
          checkExpression(
            'quotation_line_amounts_fd82e6b1',
            'quantity > 0 AND "unitPrice" >= 0 AND "taxRate" >= 0 AND "taxRate" <= 100',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'RetentionPolicy',
        columns: [
          col('basis', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('recordCategory', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('retentionYears', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('updatedById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('retention_years_positive_bf366625', '"retentionYears" > 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Role',
        columns: [
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'RolePermission',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('permissionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('roleId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Shipment',
        columns: [
          col('agentId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('assignedToId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('ata', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('atd', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('bookingId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('cargoDescription', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('carrierId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('createdById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('customerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('deliveredAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('destination', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('direction', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('equipment', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('estimatedDeliveryAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('eta', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('etd', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('grossWeightKg', 'numeric(12,3)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 12, scale: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('mode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('origin', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('packages', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('reference', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('booked'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('transportDocRef', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('vesselOrFlight', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('volumeCbm', 'numeric(12,3)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 12, scale: 3 } },
          }),
          col('voyageNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Shipment_direction_check_8057d484',
            "\"direction\" IN ('import', 'export', 'transit')",
          ),
          checkExpression(
            'Shipment_mode_check_6b0005c5',
            "\"mode\" IN ('sea', 'air', 'road', 'rail')",
          ),
          checkExpression(
            'Shipment_status_check_1c66eb2f',
            "\"status\" IN ('booked', 'in_transit', 'arrived', 'customs', 'released', 'out_for_delivery', 'delivered', 'on_hold')",
          ),
          checkExpression(
            'shipment_arrival_after_departure_93038efa',
            'atd IS NULL OR ata IS NULL OR ata >= atd',
          ),
          checkExpression(
            'shipment_delivered_has_time_7610c5a2',
            'status <> \'delivered\' OR "deliveredAt" IS NOT NULL',
          ),
          checkExpression(
            'shipment_delivery_after_arrival_96841ede',
            'ata IS NULL OR "deliveredAt" IS NULL OR "deliveredAt" >= ata',
          ),
          checkExpression(
            'shipment_packages_non_negative_386adbd2',
            'packages IS NULL OR packages >= 0',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'ShipmentIssue',
        columns: [
          col('affectedMilestoneId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('affectsEta', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('createdById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('customerNotification', 'text', {
            notNull: true,
            default: lit('not_notified'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('customerNotifiedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('followUpUserId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('identifiedAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('nextAction', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('originalExpectedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('reason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reasonDetail', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('resolution', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('resolvedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('revisedExpectedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('severity', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('shipmentId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('open'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ShipmentIssue_customerNotification_check_73f1ecb3',
            "\"customerNotification\" IN ('not_notified', 'informed_manually', 'not_required')",
          ),
          checkExpression(
            'ShipmentIssue_reason_check_ca1c5c74',
            "\"reason\" IN ('port_congestion', 'border_queue', 'carrier_schedule', 'customs_query', 'missing_documents', 'permit_pending', 'payment_pending', 'equipment_shortage', 'weather', 'other')",
          ),
          checkExpression(
            'ShipmentIssue_severity_check_b1a0cf80',
            "\"severity\" IN ('low', 'medium', 'high')",
          ),
          checkExpression(
            'ShipmentIssue_status_check_e3717bc8',
            "\"status\" IN ('open', 'monitoring', 'resolved')",
          ),
          checkExpression(
            'ShipmentIssue_type_check_5fd7e7a0',
            "\"type\" IN ('delay', 'damage', 'documentation', 'customs_query', 'other')",
          ),
          checkExpression(
            'issue_delay_fields_b8f38fca',
            'type <> \'delay\' OR (reason IS NOT NULL AND "originalExpectedAt" IS NOT NULL)',
          ),
          checkExpression(
            'issue_notified_has_time_52968961',
            '"customerNotification" <> \'informed_manually\' OR "customerNotifiedAt" IS NOT NULL',
          ),
          checkExpression(
            'issue_resolved_has_time_b06059e8',
            'status <> \'resolved\' OR "resolvedAt" IS NOT NULL',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'ShipmentMilestone',
        columns: [
          col('actualAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('label', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('location', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('plannedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('recordedById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('sequence', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('shipmentId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Task',
        columns: [
          col('assigneeId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('completedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('createdById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('details', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('documentId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('dueAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('invoiceId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('priority', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('quotationId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('shipmentId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('open'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Task_priority_check_ce55d8f4',
            "\"priority\" IN ('low', 'medium', 'high')",
          ),
          checkExpression(
            'Task_status_check_f624cd03',
            "\"status\" IN ('open', 'in_progress', 'done', 'cancelled')",
          ),
          checkExpression(
            'task_done_has_time_d1290b07',
            'status <> \'done\' OR "completedAt" IS NOT NULL',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'TransportJob',
        columns: [
          col('actualDeliveryAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('actualPickupAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('containerId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('deliveryLocation', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('driverName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('driverPhone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('pickupLocation', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('plannedDeliveryAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('plannedPickupAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('shipmentId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('planned'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('transporterId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('truckRegistration', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'TransportJob_status_check_2ba9481d',
            "\"status\" IN ('planned', 'dispatched', 'delivered', 'cancelled')",
          ),
          checkExpression(
            'transport_job_delivered_has_time_6d43f58b',
            'status <> \'delivered\' OR "actualDeliveryAt" IS NOT NULL',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'UserRole',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('roleId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('lastLoginAt', 'timestamptz(3)', {
          codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('partyId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('passwordHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('status', 'text', {
          notNull: true,
          default: lit('active'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('updatedAt', 'timestamptz(3)', {
          notNull: true,
          default: fn('now()'),
          codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'Booking',
        constraint: 'Booking_reference_key',
        columns: ['reference'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Booking',
        constraint: 'Booking_quotationId_key',
        columns: ['quotationId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ChargeType',
        constraint: 'ChargeType_code_key',
        columns: ['code'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Container',
        constraint: 'Container_shipmentId_containerNumber_key',
        columns: ['shipmentId', 'containerNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'CreditNote',
        constraint: 'CreditNote_number_key',
        columns: ['number'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'CustomsEntry',
        constraint: 'CustomsEntry_reference_key',
        columns: ['reference'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Document',
        constraint: 'Document_storageKey_key',
        columns: ['storageKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Expense',
        constraint: 'Expense_customsChargeId_key',
        columns: ['customsChargeId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Expense',
        constraint: 'Expense_invoiceLineId_key',
        columns: ['invoiceLineId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Invoice',
        constraint: 'Invoice_number_key',
        columns: ['number'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'NumberSequence',
        constraint: 'NumberSequence_prefix_year_key',
        columns: ['prefix', 'year'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'PartyRole',
        constraint: 'PartyRole_partyId_role_key',
        columns: ['partyId', 'role'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Payment',
        constraint: 'Payment_reference_key',
        columns: ['reference'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'PaymentAllocation',
        constraint: 'PaymentAllocation_paymentId_invoiceId_key',
        columns: ['paymentId', 'invoiceId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Permission',
        constraint: 'Permission_code_key',
        columns: ['code'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Quotation',
        constraint: 'Quotation_reference_key',
        columns: ['reference'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'RetentionPolicy',
        constraint: 'RetentionPolicy_recordCategory_key',
        columns: ['recordCategory'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Role',
        constraint: 'Role_code_key',
        columns: ['code'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'RolePermission',
        constraint: 'RolePermission_roleId_permissionId_key',
        columns: ['roleId', 'permissionId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Shipment',
        constraint: 'Shipment_reference_key',
        columns: ['reference'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ShipmentMilestone',
        constraint: 'ShipmentMilestone_shipmentId_sequence_key',
        columns: ['shipmentId', 'sequence'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'User',
        constraint: 'User_status_check_282eda46',
        expression: "\"status\" IN ('active', 'invited', 'disabled')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'UserRole',
        constraint: 'UserRole_userId_roleId_key',
        columns: ['userId', 'roleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_actorUserId_idx_96dac96c',
        columns: ['actorUserId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_entityType_entityId_idx_ea0fa809',
        columns: ['entityType', 'entityId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_occurredAt_idx_c6b89167',
        columns: ['occurredAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_agentId_idx_8d0ba4f0',
        columns: ['agentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_carrierId_idx_d9ee4c0f',
        columns: ['carrierId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_createdById_idx_8bf640ed',
        columns: ['createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_customerId_idx_b2a8a46c',
        columns: ['customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_customerId_status_idx_2986b558',
        columns: ['customerId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Contact',
        index: 'Contact_partyId_idx_e302b09d',
        columns: ['partyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Container',
        index: 'Container_containerNumber_idx_47b96895',
        columns: ['containerNumber'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Container',
        index: 'Container_shipmentId_idx_e3606ec1',
        columns: ['shipmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CreditCheck',
        index: 'CreditCheck_bookingId_idx_17848f4a',
        columns: ['bookingId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CreditCheck',
        index: 'CreditCheck_customerId_decidedAt_idx_59912b48',
        columns: ['customerId', 'decidedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CreditCheck',
        index: 'CreditCheck_customerId_idx_b2a8a46c',
        columns: ['customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CreditCheck',
        index: 'CreditCheck_decidedById_idx_8194d55f',
        columns: ['decidedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CreditCheck',
        index: 'CreditCheck_invoiceId_idx_d5c4f70e',
        columns: ['invoiceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CreditNote',
        index: 'CreditNote_createdById_idx_8bf640ed',
        columns: ['createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CreditNote',
        index: 'CreditNote_invoiceId_idx_d5c4f70e',
        columns: ['invoiceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CreditNote',
        index: 'CreditNote_issuedById_idx_c14f1329',
        columns: ['issuedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CreditNoteLine',
        index: 'CreditNoteLine_creditNoteId_idx_2a875364',
        columns: ['creditNoteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CreditNoteLine',
        index: 'CreditNoteLine_invoiceLineId_idx_1805647d',
        columns: ['invoiceLineId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CustomsCharge',
        index: 'CustomsCharge_chargeTypeId_idx_15040fb7',
        columns: ['chargeTypeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CustomsCharge',
        index: 'CustomsCharge_customsEntryId_idx_8469d0e8',
        columns: ['customsEntryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CustomsEntry',
        index: 'CustomsEntry_createdById_idx_8bf640ed',
        columns: ['createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CustomsEntry',
        index: 'CustomsEntry_shipmentId_idx_e3606ec1',
        columns: ['shipmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CustomsEntry',
        index: 'CustomsEntry_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CustomsEntry',
        index: 'customs_declaration_number_unique_38c88d37',
        columns: ['declarationNumber'],
        extras: { where: '("declarationNumber" IS NOT NULL)', unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'Document',
        index: 'Document_bookingId_idx_17848f4a',
        columns: ['bookingId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Document',
        index: 'Document_customsEntryId_idx_8469d0e8',
        columns: ['customsEntryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Document',
        index: 'Document_invoiceId_idx_d5c4f70e',
        columns: ['invoiceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Document',
        index: 'Document_partyId_idx_e302b09d',
        columns: ['partyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Document',
        index: 'Document_quotationId_idx_951eb9ae',
        columns: ['quotationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Document',
        index: 'Document_reviewedById_idx_e2835478',
        columns: ['reviewedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Document',
        index: 'Document_shipmentId_idx_e3606ec1',
        columns: ['shipmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Document',
        index: 'Document_shipmentId_status_idx_97dbc20a',
        columns: ['shipmentId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Document',
        index: 'Document_uploadedById_idx_b92fad21',
        columns: ['uploadedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Expense',
        index: 'Expense_approvedById_idx_01ef8410',
        columns: ['approvedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Expense',
        index: 'Expense_chargeTypeId_idx_15040fb7',
        columns: ['chargeTypeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Expense',
        index: 'Expense_recordedById_idx_6595df66',
        columns: ['recordedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Expense',
        index: 'Expense_shipmentId_idx_e3606ec1',
        columns: ['shipmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Expense',
        index: 'Expense_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Expense',
        index: 'Expense_supplierId_idx_c4d9a8b9',
        columns: ['supplierId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Expense',
        index: 'Expense_transportJobId_idx_e73de3c6',
        columns: ['transportJobId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Invoice',
        index: 'Invoice_createdById_idx_8bf640ed',
        columns: ['createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Invoice',
        index: 'Invoice_customerId_idx_b2a8a46c',
        columns: ['customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Invoice',
        index: 'Invoice_customerId_status_dueDate_idx_cc28dfbd',
        columns: ['customerId', 'status', 'dueDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Invoice',
        index: 'Invoice_issuedById_idx_c14f1329',
        columns: ['issuedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Invoice',
        index: 'Invoice_shipmentId_idx_e3606ec1',
        columns: ['shipmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'InvoiceLine',
        index: 'InvoiceLine_chargeTypeId_idx_15040fb7',
        columns: ['chargeTypeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'InvoiceLine',
        index: 'InvoiceLine_invoiceId_idx_d5c4f70e',
        columns: ['invoiceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Note',
        index: 'Note_authorId_idx_e47547ed',
        columns: ['authorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Note',
        index: 'Note_shipmentIssueId_idx_6facd194',
        columns: ['shipmentIssueId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Note',
        index: 'Note_taskId_idx_4965c936',
        columns: ['taskId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Party',
        index: 'Party_createdById_idx_8bf640ed',
        columns: ['createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Party',
        index: 'Party_name_idx_ce87e6ba',
        columns: ['name'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Party',
        index: 'party_kra_pin_unique_2fc9cb04',
        columns: ['kraPin'],
        extras: { where: '("kraPin" IS NOT NULL)', unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'PartyRole',
        index: 'PartyRole_partyId_idx_e302b09d',
        columns: ['partyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PartyRole',
        index: 'PartyRole_role_idx_2c1ddf83',
        columns: ['role'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Payment',
        index: 'Payment_customerId_idx_b2a8a46c',
        columns: ['customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Payment',
        index: 'Payment_customerId_receivedAt_idx_17671673',
        columns: ['customerId', 'receivedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Payment',
        index: 'Payment_reconciledById_idx_87e33dbc',
        columns: ['reconciledById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Payment',
        index: 'Payment_recordedById_idx_6595df66',
        columns: ['recordedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Payment',
        index: 'Payment_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Payment',
        index: 'payment_bank_reference_unique_a7bb3307',
        columns: ['externalReference'],
        extras: {
          where:
            "(method = 'bank_transfer' AND \"externalReference\" IS NOT NULL AND status <> 'cancelled')",
          unique: true,
        },
      }),
      this.createIndex({
        schema: 'public',
        table: 'PaymentAllocation',
        index: 'PaymentAllocation_allocatedById_idx_22f38a31',
        columns: ['allocatedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PaymentAllocation',
        index: 'PaymentAllocation_invoiceId_idx_d5c4f70e',
        columns: ['invoiceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PaymentAllocation',
        index: 'PaymentAllocation_paymentId_idx_b2fe9a10',
        columns: ['paymentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Quotation',
        index: 'Quotation_agentId_idx_8d0ba4f0',
        columns: ['agentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Quotation',
        index: 'Quotation_customerId_idx_b2a8a46c',
        columns: ['customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Quotation',
        index: 'Quotation_customerId_status_idx_2986b558',
        columns: ['customerId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Quotation',
        index: 'Quotation_duplicatedFromId_idx_79fc5952',
        columns: ['duplicatedFromId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Quotation',
        index: 'Quotation_preparedById_idx_1dcf84f2',
        columns: ['preparedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Quotation',
        index: 'Quotation_status_validUntil_idx_eb652944',
        columns: ['status', 'validUntil'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'QuotationLine',
        index: 'QuotationLine_chargeTypeId_idx_15040fb7',
        columns: ['chargeTypeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'QuotationLine',
        index: 'QuotationLine_quotationId_idx_951eb9ae',
        columns: ['quotationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RetentionPolicy',
        index: 'RetentionPolicy_updatedById_idx_d0517c24',
        columns: ['updatedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RolePermission',
        index: 'RolePermission_permissionId_idx_f46fcdf5',
        columns: ['permissionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RolePermission',
        index: 'RolePermission_roleId_idx_ffccc9a4',
        columns: ['roleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Shipment',
        index: 'Shipment_agentId_idx_8d0ba4f0',
        columns: ['agentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Shipment',
        index: 'Shipment_assignedToId_idx_45a131c2',
        columns: ['assignedToId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Shipment',
        index: 'Shipment_bookingId_idx_17848f4a',
        columns: ['bookingId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Shipment',
        index: 'Shipment_carrierId_idx_d9ee4c0f',
        columns: ['carrierId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Shipment',
        index: 'Shipment_createdById_idx_8bf640ed',
        columns: ['createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Shipment',
        index: 'Shipment_customerId_idx_b2a8a46c',
        columns: ['customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Shipment',
        index: 'Shipment_customerId_status_idx_2986b558',
        columns: ['customerId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Shipment',
        index: 'Shipment_status_eta_idx_592b1e3f',
        columns: ['status', 'eta'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ShipmentIssue',
        index: 'ShipmentIssue_affectedMilestoneId_idx_f64a1556',
        columns: ['affectedMilestoneId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ShipmentIssue',
        index: 'ShipmentIssue_createdById_idx_8bf640ed',
        columns: ['createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ShipmentIssue',
        index: 'ShipmentIssue_followUpUserId_idx_2358e947',
        columns: ['followUpUserId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ShipmentIssue',
        index: 'ShipmentIssue_shipmentId_idx_e3606ec1',
        columns: ['shipmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ShipmentIssue',
        index: 'shipment_issue_open_7af421a5',
        columns: ['shipmentId'],
        extras: { where: "(status <> 'resolved')" },
      }),
      this.createIndex({
        schema: 'public',
        table: 'ShipmentMilestone',
        index: 'ShipmentMilestone_recordedById_idx_6595df66',
        columns: ['recordedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ShipmentMilestone',
        index: 'ShipmentMilestone_shipmentId_idx_e3606ec1',
        columns: ['shipmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_assigneeId_idx_fd12ae38',
        columns: ['assigneeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_assigneeId_status_dueAt_idx_fe7a2cbf',
        columns: ['assigneeId', 'status', 'dueAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_createdById_idx_8bf640ed',
        columns: ['createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_documentId_idx_825ef746',
        columns: ['documentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_invoiceId_idx_d5c4f70e',
        columns: ['invoiceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_quotationId_idx_951eb9ae',
        columns: ['quotationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_shipmentId_idx_e3606ec1',
        columns: ['shipmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TransportJob',
        index: 'TransportJob_containerId_idx_055d509a',
        columns: ['containerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TransportJob',
        index: 'TransportJob_shipmentId_idx_e3606ec1',
        columns: ['shipmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TransportJob',
        index: 'TransportJob_transporterId_idx_699f0b18',
        columns: ['transporterId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'User',
        index: 'User_partyId_idx_e302b09d',
        columns: ['partyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'UserRole',
        index: 'UserRole_roleId_idx_ffccc9a4',
        columns: ['roleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'UserRole',
        index: 'UserRole_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AuditLog',
        foreignKey: {
          name: 'AuditLog_actorUserId_fkey',
          columns: ['actorUserId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Booking',
        foreignKey: {
          name: 'Booking_quotationId_fkey',
          columns: ['quotationId'],
          references: { schema: 'public', table: 'Quotation', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Booking',
        foreignKey: {
          name: 'Booking_customerId_fkey',
          columns: ['customerId'],
          references: { schema: 'public', table: 'Party', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Booking',
        foreignKey: {
          name: 'Booking_carrierId_fkey',
          columns: ['carrierId'],
          references: { schema: 'public', table: 'Party', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Booking',
        foreignKey: {
          name: 'Booking_agentId_fkey',
          columns: ['agentId'],
          references: { schema: 'public', table: 'Party', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Booking',
        foreignKey: {
          name: 'Booking_createdById_fkey',
          columns: ['createdById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Contact',
        foreignKey: {
          name: 'Contact_partyId_fkey',
          columns: ['partyId'],
          references: { schema: 'public', table: 'Party', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Container',
        foreignKey: {
          name: 'Container_shipmentId_fkey',
          columns: ['shipmentId'],
          references: { schema: 'public', table: 'Shipment', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CreditCheck',
        foreignKey: {
          name: 'CreditCheck_customerId_fkey',
          columns: ['customerId'],
          references: { schema: 'public', table: 'Party', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CreditCheck',
        foreignKey: {
          name: 'CreditCheck_bookingId_fkey',
          columns: ['bookingId'],
          references: { schema: 'public', table: 'Booking', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CreditCheck',
        foreignKey: {
          name: 'CreditCheck_invoiceId_fkey',
          columns: ['invoiceId'],
          references: { schema: 'public', table: 'Invoice', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CreditCheck',
        foreignKey: {
          name: 'CreditCheck_decidedById_fkey',
          columns: ['decidedById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CreditNote',
        foreignKey: {
          name: 'CreditNote_invoiceId_fkey',
          columns: ['invoiceId'],
          references: { schema: 'public', table: 'Invoice', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CreditNote',
        foreignKey: {
          name: 'CreditNote_issuedById_fkey',
          columns: ['issuedById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CreditNote',
        foreignKey: {
          name: 'CreditNote_createdById_fkey',
          columns: ['createdById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CreditNoteLine',
        foreignKey: {
          name: 'CreditNoteLine_creditNoteId_fkey',
          columns: ['creditNoteId'],
          references: { schema: 'public', table: 'CreditNote', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CreditNoteLine',
        foreignKey: {
          name: 'CreditNoteLine_invoiceLineId_fkey',
          columns: ['invoiceLineId'],
          references: { schema: 'public', table: 'InvoiceLine', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CustomsCharge',
        foreignKey: {
          name: 'CustomsCharge_customsEntryId_fkey',
          columns: ['customsEntryId'],
          references: { schema: 'public', table: 'CustomsEntry', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CustomsCharge',
        foreignKey: {
          name: 'CustomsCharge_chargeTypeId_fkey',
          columns: ['chargeTypeId'],
          references: { schema: 'public', table: 'ChargeType', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CustomsEntry',
        foreignKey: {
          name: 'CustomsEntry_shipmentId_fkey',
          columns: ['shipmentId'],
          references: { schema: 'public', table: 'Shipment', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CustomsEntry',
        foreignKey: {
          name: 'CustomsEntry_createdById_fkey',
          columns: ['createdById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Document',
        foreignKey: {
          name: 'Document_uploadedById_fkey',
          columns: ['uploadedById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Document',
        foreignKey: {
          name: 'Document_reviewedById_fkey',
          columns: ['reviewedById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Document',
        foreignKey: {
          name: 'Document_partyId_fkey',
          columns: ['partyId'],
          references: { schema: 'public', table: 'Party', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Document',
        foreignKey: {
          name: 'Document_quotationId_fkey',
          columns: ['quotationId'],
          references: { schema: 'public', table: 'Quotation', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Document',
        foreignKey: {
          name: 'Document_bookingId_fkey',
          columns: ['bookingId'],
          references: { schema: 'public', table: 'Booking', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Document',
        foreignKey: {
          name: 'Document_shipmentId_fkey',
          columns: ['shipmentId'],
          references: { schema: 'public', table: 'Shipment', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Document',
        foreignKey: {
          name: 'Document_customsEntryId_fkey',
          columns: ['customsEntryId'],
          references: { schema: 'public', table: 'CustomsEntry', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Document',
        foreignKey: {
          name: 'Document_invoiceId_fkey',
          columns: ['invoiceId'],
          references: { schema: 'public', table: 'Invoice', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Expense',
        foreignKey: {
          name: 'Expense_shipmentId_fkey',
          columns: ['shipmentId'],
          references: { schema: 'public', table: 'Shipment', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Expense',
        foreignKey: {
          name: 'Expense_transportJobId_fkey',
          columns: ['transportJobId'],
          references: { schema: 'public', table: 'TransportJob', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Expense',
        foreignKey: {
          name: 'Expense_customsChargeId_fkey',
          columns: ['customsChargeId'],
          references: { schema: 'public', table: 'CustomsCharge', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Expense',
        foreignKey: {
          name: 'Expense_supplierId_fkey',
          columns: ['supplierId'],
          references: { schema: 'public', table: 'Party', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Expense',
        foreignKey: {
          name: 'Expense_chargeTypeId_fkey',
          columns: ['chargeTypeId'],
          references: { schema: 'public', table: 'ChargeType', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Expense',
        foreignKey: {
          name: 'Expense_approvedById_fkey',
          columns: ['approvedById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Expense',
        foreignKey: {
          name: 'Expense_invoiceLineId_fkey',
          columns: ['invoiceLineId'],
          references: { schema: 'public', table: 'InvoiceLine', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Expense',
        foreignKey: {
          name: 'Expense_recordedById_fkey',
          columns: ['recordedById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Invoice',
        foreignKey: {
          name: 'Invoice_shipmentId_fkey',
          columns: ['shipmentId'],
          references: { schema: 'public', table: 'Shipment', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Invoice',
        foreignKey: {
          name: 'Invoice_customerId_fkey',
          columns: ['customerId'],
          references: { schema: 'public', table: 'Party', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Invoice',
        foreignKey: {
          name: 'Invoice_issuedById_fkey',
          columns: ['issuedById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Invoice',
        foreignKey: {
          name: 'Invoice_createdById_fkey',
          columns: ['createdById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'InvoiceLine',
        foreignKey: {
          name: 'InvoiceLine_invoiceId_fkey',
          columns: ['invoiceId'],
          references: { schema: 'public', table: 'Invoice', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'InvoiceLine',
        foreignKey: {
          name: 'InvoiceLine_chargeTypeId_fkey',
          columns: ['chargeTypeId'],
          references: { schema: 'public', table: 'ChargeType', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Note',
        foreignKey: {
          name: 'Note_authorId_fkey',
          columns: ['authorId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Note',
        foreignKey: {
          name: 'Note_taskId_fkey',
          columns: ['taskId'],
          references: { schema: 'public', table: 'Task', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Note',
        foreignKey: {
          name: 'Note_shipmentIssueId_fkey',
          columns: ['shipmentIssueId'],
          references: { schema: 'public', table: 'ShipmentIssue', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Party',
        foreignKey: {
          name: 'Party_createdById_fkey',
          columns: ['createdById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PartyRole',
        foreignKey: {
          name: 'PartyRole_partyId_fkey',
          columns: ['partyId'],
          references: { schema: 'public', table: 'Party', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Payment',
        foreignKey: {
          name: 'Payment_customerId_fkey',
          columns: ['customerId'],
          references: { schema: 'public', table: 'Party', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Payment',
        foreignKey: {
          name: 'Payment_reconciledById_fkey',
          columns: ['reconciledById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Payment',
        foreignKey: {
          name: 'Payment_recordedById_fkey',
          columns: ['recordedById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PaymentAllocation',
        foreignKey: {
          name: 'PaymentAllocation_paymentId_fkey',
          columns: ['paymentId'],
          references: { schema: 'public', table: 'Payment', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PaymentAllocation',
        foreignKey: {
          name: 'PaymentAllocation_invoiceId_fkey',
          columns: ['invoiceId'],
          references: { schema: 'public', table: 'Invoice', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PaymentAllocation',
        foreignKey: {
          name: 'PaymentAllocation_allocatedById_fkey',
          columns: ['allocatedById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Quotation',
        foreignKey: {
          name: 'Quotation_customerId_fkey',
          columns: ['customerId'],
          references: { schema: 'public', table: 'Party', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Quotation',
        foreignKey: {
          name: 'Quotation_agentId_fkey',
          columns: ['agentId'],
          references: { schema: 'public', table: 'Party', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Quotation',
        foreignKey: {
          name: 'Quotation_duplicatedFromId_fkey',
          columns: ['duplicatedFromId'],
          references: { schema: 'public', table: 'Quotation', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Quotation',
        foreignKey: {
          name: 'Quotation_preparedById_fkey',
          columns: ['preparedById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'QuotationLine',
        foreignKey: {
          name: 'QuotationLine_quotationId_fkey',
          columns: ['quotationId'],
          references: { schema: 'public', table: 'Quotation', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'QuotationLine',
        foreignKey: {
          name: 'QuotationLine_chargeTypeId_fkey',
          columns: ['chargeTypeId'],
          references: { schema: 'public', table: 'ChargeType', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RetentionPolicy',
        foreignKey: {
          name: 'RetentionPolicy_updatedById_fkey',
          columns: ['updatedById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RolePermission',
        foreignKey: {
          name: 'RolePermission_roleId_fkey',
          columns: ['roleId'],
          references: { schema: 'public', table: 'Role', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RolePermission',
        foreignKey: {
          name: 'RolePermission_permissionId_fkey',
          columns: ['permissionId'],
          references: { schema: 'public', table: 'Permission', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Shipment',
        foreignKey: {
          name: 'Shipment_bookingId_fkey',
          columns: ['bookingId'],
          references: { schema: 'public', table: 'Booking', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Shipment',
        foreignKey: {
          name: 'Shipment_customerId_fkey',
          columns: ['customerId'],
          references: { schema: 'public', table: 'Party', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Shipment',
        foreignKey: {
          name: 'Shipment_carrierId_fkey',
          columns: ['carrierId'],
          references: { schema: 'public', table: 'Party', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Shipment',
        foreignKey: {
          name: 'Shipment_agentId_fkey',
          columns: ['agentId'],
          references: { schema: 'public', table: 'Party', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Shipment',
        foreignKey: {
          name: 'Shipment_assignedToId_fkey',
          columns: ['assignedToId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Shipment',
        foreignKey: {
          name: 'Shipment_createdById_fkey',
          columns: ['createdById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ShipmentIssue',
        foreignKey: {
          name: 'ShipmentIssue_shipmentId_fkey',
          columns: ['shipmentId'],
          references: { schema: 'public', table: 'Shipment', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ShipmentIssue',
        foreignKey: {
          name: 'ShipmentIssue_affectedMilestoneId_fkey',
          columns: ['affectedMilestoneId'],
          references: { schema: 'public', table: 'ShipmentMilestone', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ShipmentIssue',
        foreignKey: {
          name: 'ShipmentIssue_followUpUserId_fkey',
          columns: ['followUpUserId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ShipmentIssue',
        foreignKey: {
          name: 'ShipmentIssue_createdById_fkey',
          columns: ['createdById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ShipmentMilestone',
        foreignKey: {
          name: 'ShipmentMilestone_shipmentId_fkey',
          columns: ['shipmentId'],
          references: { schema: 'public', table: 'Shipment', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ShipmentMilestone',
        foreignKey: {
          name: 'ShipmentMilestone_recordedById_fkey',
          columns: ['recordedById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Task',
        foreignKey: {
          name: 'Task_assigneeId_fkey',
          columns: ['assigneeId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Task',
        foreignKey: {
          name: 'Task_shipmentId_fkey',
          columns: ['shipmentId'],
          references: { schema: 'public', table: 'Shipment', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Task',
        foreignKey: {
          name: 'Task_quotationId_fkey',
          columns: ['quotationId'],
          references: { schema: 'public', table: 'Quotation', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Task',
        foreignKey: {
          name: 'Task_documentId_fkey',
          columns: ['documentId'],
          references: { schema: 'public', table: 'Document', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Task',
        foreignKey: {
          name: 'Task_invoiceId_fkey',
          columns: ['invoiceId'],
          references: { schema: 'public', table: 'Invoice', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Task',
        foreignKey: {
          name: 'Task_createdById_fkey',
          columns: ['createdById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TransportJob',
        foreignKey: {
          name: 'TransportJob_shipmentId_fkey',
          columns: ['shipmentId'],
          references: { schema: 'public', table: 'Shipment', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TransportJob',
        foreignKey: {
          name: 'TransportJob_containerId_fkey',
          columns: ['containerId'],
          references: { schema: 'public', table: 'Container', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TransportJob',
        foreignKey: {
          name: 'TransportJob_transporterId_fkey',
          columns: ['transporterId'],
          references: { schema: 'public', table: 'Party', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'User',
        foreignKey: {
          name: 'User_partyId_fkey',
          columns: ['partyId'],
          references: { schema: 'public', table: 'Party', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'UserRole',
        foreignKey: {
          name: 'UserRole_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'UserRole',
        foreignKey: {
          name: 'UserRole_roleId_fkey',
          columns: ['roleId'],
          references: { schema: 'public', table: 'Role', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
