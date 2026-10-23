/** Uploaded slide images are served from here. The id is 32 random hex characters. Anyone who has the link can view the image. */
export const MEDIA_PATH = /^\/api\/media\/[a-f0-9]{32}$/;
export const MAX_IMAGE_BYTES = 600 * 1024;
export const MAX_IMAGES_PER_USER = 200;

/**
 * The real type of an image from its first bytes. The Content-Type header is client-controlled, so it is
 * never trusted. SVG is not accepted: it can carry script.
 */
export function sniffImageType(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}
