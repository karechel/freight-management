'use client';

import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice, PendingNotice, RecordNotFound, SESSION_EDIT_NOTE } from '@/components/ui/states';
import { useSessionQuotation } from '@/lib/data/session-store';
import { quotationStatusMeta } from '@/lib/labels';
import { canEditQuotation } from '@/lib/quotation-changes';
import { effectiveQuotationStatus } from '@/lib/quotations';
import type { DataSource } from '@/lib/types';
import { QuotationForm, type QuotationFormOptions } from './quotation-form';
import { quotationHref } from './quotation-list';

/** Page body for creating, duplicating (`reference` = source) or editing (`reference` = draft) a quotation. */
export function QuotationFormView({
  mode,
  reference,
  options,
  source,
  referenceDate,
}: {
  mode: 'create' | 'duplicate' | 'edit';
  reference?: string;
  options: QuotationFormOptions;
  source: DataSource;
  referenceDate: string;
}) {
  const quotation = useSessionQuotation(reference ?? '');
  if (mode !== 'create' && !quotation) {
    return <RecordNotFound title={`Quotation ${reference} was not found`} backHref="/quotations" backLabel="All quotations" />;
  }
  const banner = <DataSourceNotice source={source}>{SESSION_EDIT_NOTE}</DataSourceNotice>;

  if (mode === 'edit' && quotation) {
    const back = { href: quotationHref(quotation.reference), label: 'Back to quotation' };
    if (!canEditQuotation(quotation, referenceDate)) {
      return (
        <>
          <PageHeader title={`Edit ${quotation.reference}`} back={back} />
          <PendingNotice title="Only drafts can be edited">
            {quotation.reference} is &quot;{quotationStatusMeta[effectiveQuotationStatus(quotation, referenceDate)].label}&quot;. To change
            the offer, duplicate it as a new draft so the version the customer saw stays unchanged.
          </PendingNotice>
        </>
      );
    }
    return (
      <>
        <PageHeader title={`Edit ${quotation.reference}`} description={`${quotation.customerName}. Fields marked * are required.`} back={back} />
        {banner}
        <QuotationForm options={options} quotation={quotation} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={quotation ? `Duplicate ${quotation.reference}` : 'New quotation'}
        description={
          quotation
            ? 'Creates a new draft with the same customer, route and lines. Set new issue and validity dates.'
            : 'Fields marked * are required.'
        }
        back={quotation ? { href: quotationHref(quotation.reference), label: 'Back to quotation' } : { href: '/quotations', label: 'All quotations' }}
      />
      {banner}
      <QuotationForm options={options} duplicateOf={quotation} />
    </>
  );
}
