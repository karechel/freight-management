// File checks for document uploads. Pure functions except `readFileHead`.
// A file is accepted only if its extension, the browser-reported MIME type
// (when present) and its leading bytes all agree with one allowed format, so
// a renamed executable or script is rejected.

export interface FileFormat {
  label: string;
  extensions: string[];
  /** MIME types browsers report for this format. The first is stored. */
  mimeTypes: string[];
  /** Leading byte signature (magic number). */
  signature: number[];
}

const ZIP = [0x50, 0x4b, 0x03, 0x04]; // .docx / .xlsx are ZIP containers
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // legacy .doc / .xls

export const allowedFormats: FileFormat[] = [
  { label: 'PDF', extensions: ['pdf'], mimeTypes: ['application/pdf'], signature: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { label: 'JPEG image', extensions: ['jpg', 'jpeg'], mimeTypes: ['image/jpeg'], signature: [0xff, 0xd8, 0xff] },
  { label: 'PNG image', extensions: ['png'], mimeTypes: ['image/png'], signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  {
    label: 'Word document',
    extensions: ['docx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    signature: ZIP,
  },
  { label: 'Word 97–2003 document', extensions: ['doc'], mimeTypes: ['application/msword'], signature: OLE },
  {
    label: 'Excel workbook',
    extensions: ['xlsx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    signature: ZIP,
  },
  { label: 'Excel 97–2003 workbook', extensions: ['xls'], mimeTypes: ['application/vnd.ms-excel'], signature: OLE },
];

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 10;
/** Files are kept in the tab's memory; this caps how much a session can hold. */
export const MAX_SESSION_BYTES = 100 * 1024 * 1024;
const MAX_NAME_LENGTH = 200;
export const SIGNATURE_BYTES = 8;

/** Value for the file input's `accept` attribute. */
export const acceptAttribute = allowedFormats.flatMap((f) => [...f.extensions.map((e) => `.${e}`), ...f.mimeTypes]).join(',');

export const allowedSummary = 'PDF, JPEG, PNG, Word (.doc, .docx) or Excel (.xls, .xlsx), up to 10 MB each';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const extensionOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

export interface FileCheckResult {
  format?: FileFormat;
  error?: string;
}

/** Checks that need only name, size and reported type. */
export function checkFileBasics(file: { name: string; size: number; type: string }): FileCheckResult {
  if (file.name.length > MAX_NAME_LENGTH) return { error: `The file name is longer than ${MAX_NAME_LENGTH} characters. Rename it and try again.` };
  const ext = extensionOf(file.name);
  const format = allowedFormats.find((f) => f.extensions.includes(ext));
  if (!format) return { error: `Unsupported file type${ext ? ` (.${ext})` : ''}. Use ${allowedSummary}.` };
  if (file.size === 0) return { error: 'The file is empty.' };
  if (file.size > MAX_FILE_BYTES) return { error: `The file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_FILE_BYTES)}.` };
  // Browsers sometimes report no type, or a generic one, for valid files; only a conflicting specific type is rejected.
  if (file.type && file.type !== 'application/octet-stream' && !format.mimeTypes.includes(file.type)) {
    return { error: `The file is named .${ext} but the browser reports it as "${file.type}". Check that it is a genuine ${format.label}.` };
  }
  return { format };
}

/** Checks the leading bytes against the format's signature. */
export function checkSignature(head: Uint8Array, format: FileFormat): FileCheckResult {
  const matches = format.signature.every((byte, i) => head[i] === byte);
  return matches ? { format } : { error: `The contents are not a valid ${format.label}, although the name ends in .${format.extensions[0]}.` };
}

/** Reads the first bytes of a browser File. Rejects if the file can no longer be read (moved, deleted, permission). */
export async function readFileHead(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, SIGNATURE_BYTES).arrayBuffer());
}

/** Full check for one selected file. Never throws; read failures become an error message. */
export async function checkFile(file: File): Promise<FileCheckResult> {
  const basics = checkFileBasics(file);
  if (!basics.format) return basics;
  try {
    return checkSignature(await readFileHead(file), basics.format);
  } catch {
    return { error: 'The file could not be read. It may have been moved, deleted or locked. Select it again.' };
  }
}
