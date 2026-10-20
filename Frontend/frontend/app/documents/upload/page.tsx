import type { Metadata } from 'next';
import { UploadForm } from '@/components/documents/upload-form';
import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice } from '@/components/ui/states';
import { getDocuments } from '@/lib/data';
import { documentTypeLabel } from '@/lib/labels';
import type { DocumentType } from '@/lib/types';

export const metadata: Metadata = { title: 'Upload documents' };

export default async function UploadDocumentsPage({ searchParams }: PageProps<'/documents/upload'>) {
  const [documents, params] = await Promise.all([getDocuments(), searchParams]);
  const shipment = typeof params.shipment === 'string' ? params.shipment.slice(0, 40) : undefined;
  const type = typeof params.type === 'string' && Object.hasOwn(documentTypeLabel, params.type) ? (params.type as DocumentType) : undefined;
  return (
    <>
      <PageHeader
        title="Upload documents"
        description="Attach shipping and clearing documents to a shipment. Fields marked * are required."
        back={shipment ? { href: `/shipments/${encodeURIComponent(shipment)}`, label: 'Back to shipment' } : { href: '/documents', label: 'All documents' }}
      />
      <DataSourceNotice source={documents.source}>
        Selected files stay in this browser tab&apos;s memory only and are discarded when the page is reloaded.
      </DataSourceNotice>
      <UploadForm initialShipment={shipment} initialType={type} />
    </>
  );
}
