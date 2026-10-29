import type { Metadata } from 'next';
import { DocumentList } from '@/components/documents/document-list';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { SessionNotice } from '@/components/ui/session-notice';
import { DataSourceNotice, PendingNotice } from '@/components/ui/states';
import { getDocuments } from '@/lib/data';
import { documentFilters } from '@/lib/metrics';

export const metadata: Metadata = { title: 'Documents' };

export default async function DocumentsPage({ searchParams }: PageProps<'/documents'>) {
  // The list itself comes from the session store (seeded from the same data in the root layout).
  const [documents, params] = await Promise.all([getDocuments(), searchParams]);
  const status = Array.isArray(params.status) ? params.status[0] : params.status;
  const initialFilter = documentFilters.find((f) => f === status) ?? 'all';

  return (
    <>
      <PageHeader
        title="Documents"
        description="Bills of lading, air waybills, packing lists, commercial invoices, certificates of origin and declarations, by shipment."
      >
        <ButtonLink href="/documents/upload">Upload documents</ButtonLink>
      </PageHeader>
      <SessionNotice />
      <DataSourceNotice source={documents.source}>
        Uploaded files are kept in this browser tab only and are lost when the page is reloaded.
      </DataSourceNotice>
      <div className="mb-6">
        <PendingNotice title="Document storage not built">
          Files can be selected and opened in this tab for demonstration, but they are not uploaded, stored or shared.
          Permanent storage needs private, access-controlled storage on the backend. Documents must never be placed in
          the public folder or behind public links.
        </PendingNotice>
      </div>
      <Card>
        {/* key resets the filter when navigating between ?status values */}
        <DocumentList key={initialFilter} initialFilter={initialFilter} />
      </Card>
    </>
  );
}
