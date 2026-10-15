const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

type FileKind = { matches: (content: Buffer) => boolean; extension: string };

const FILE_KINDS: Record<string, FileKind> = {
  'image/jpeg': {
    matches: (b) =>
      b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    extension: '.jpg',
  },
  'image/png': {
    matches: (b) => b.subarray(0, 8).equals(PNG_SIGNATURE),
    extension: '.png',
  },
  'image/webp': {
    matches: (b) =>
      b.subarray(0, 4).toString('latin1') === 'RIFF' &&
      b.subarray(8, 12).toString('latin1') === 'WEBP',
    extension: '.webp',
  },
  'application/pdf': {
    matches: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
    extension: '.pdf',
  },
  // DOCX is a zip container; the client-declared type was already restricted by multer.
  [DOCX_MIME]: {
    matches: (b) => b.subarray(0, 4).equals(ZIP_SIGNATURE),
    extension: '.docx',
  },
};

/** Returns the extension for the declared type when the bytes really are that type, otherwise null. */
export function verifiedExtension(
  mimetype: string,
  content: Buffer | undefined,
): string | null {
  const kind = FILE_KINDS[mimetype];
  if (!kind || !content || !kind.matches(content)) return null;
  return kind.extension;
}
