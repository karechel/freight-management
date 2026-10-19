import type { Metadata } from 'next';
import { DocumentList, type DocumentFilter } from '@/components/documents/document-list';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice, PendingNotice } from '@/components/ui/states';
import { getDocuments } from '@/lib/data';

export const metadata: Metadata = { title: 'Documents' };

const allowed: DocumentFilter[] = ['all', 'outstanding', 'missing', 'rejected', 'received', 'verified'];

export default async function DocumentsPage({ searchParams }: PageProps<'/documents'>) {
  const [documents, params] = await Promise.all([getDocuments(), searchParams]);
  const status = Array.isArray(params.status) ? params.status[0] : params.status;
  const initialFilter = allowed.find((f) => f === status) ?? 'all';

  return (
    <>
      <PageHeader
        title="Documents"
        description="Bills of lading, air waybills, packing lists, commercial invoices, certificates of origin and declarations, by shipment."
      />
      <DataSourceNotice source={documents.source} />
      <div className="mb-6">
        <PendingNotice title="Document storage not built">
          This page tracks document status only. Uploading, viewing and downloading files needs private,
          access-controlled storage on the backend. Documents must never be placed in the public folder.
        </PendingNotice>
      </div>
      <Card>
        {/* key resets the filter when navigating between ?status values */}
        <DocumentList key={initialFilter} documents={documents.data} initialFilter={initialFilter} />
      </Card>
    </>
  );
}
