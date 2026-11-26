import { PendingNotice } from '@/components/ui/states';

/** Explains why some customers are missing from a new quotation or booking form. */
export function BlockedCustomersNote({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="mb-6">
      <PendingNotice title={`${count} customer${count === 1 ? ' is' : 's are'} not listed`}>
        Customers that are on hold or closed cannot receive new quotations or bookings. Management or an administrator
        must make the account active first, on the customer&apos;s page.
      </PendingNotice>
    </div>
  );
}
