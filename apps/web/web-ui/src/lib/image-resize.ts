const MAX_SIDE = 512;
const QUALITY = 0.82;

/**
 * Shrinks a profile photo in the browser (18.3): longest side 512 px, WebP (~50–100 KB).
 * Falls back to the original file when the browser cannot decode or encode it.
 */
export async function resizeProfilePhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', QUALITY));
    // Safari without WebP encoding returns PNG; keep whichever is smaller.
    if (!blob || (blob.type !== 'image/webp' && blob.size >= file.size)) return file;
    if (blob.size >= file.size && scale === 1) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + (blob.type === 'image/webp' ? '.webp' : '.png');
    return new File([blob], name, { type: blob.type });
  } catch {
    return file;
  }
}
