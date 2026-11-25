import axios from 'axios';

export const isCallGridRecording = (url: string) => /^https:\/\/api\.callgrid\.com\//.test(String(url || ''));

/**
 * Download a CallGrid recording. `audioUrl` (api.callgrid.com/api/recordings/...) needs the API key and
 * answers 302 to a signed S3 URL. Resolve the redirect with the key, then fetch S3 WITHOUT it
 * (sending our Bearer header on to S3 is pointless and can stall the request).
 * CallGrid recordings are WAV; transcription detects the format from the bytes.
 */
export async function downloadCallGridRecording(url: string, apiKey = process.env.CALLGRID_API_KEY || ''): Promise<Buffer> {
  const first = await axios.get(url, {
    maxRedirects: 0, responseType: 'arraybuffer', timeout: 30000,
    validateStatus: (s) => s >= 200 && s < 400,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const location = first.headers?.location;
  if (first.status >= 300 && location) {
    const r = await axios.get(location, { responseType: 'arraybuffer', timeout: 180000 });
    return Buffer.from(r.data);
  }
  return Buffer.from(first.data);
}
