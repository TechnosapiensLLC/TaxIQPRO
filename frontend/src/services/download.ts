/**
 * Cross-platform authenticated file download.
 * Web  -> blob + anchor download
 * Native -> write to cache dir, then open the OS share sheet
 */
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { tokenStorage } from './tokenStorage';

const BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'https://quick-revenue-apps.preview.emergentagent.com';

function filenameFromDisposition(header: string | null, fallback: string) {
  if (!header) return fallback;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return match ? decodeURIComponent(match[1]) : fallback;
}

export async function downloadExport(
  path: string,
  fallbackName: string
): Promise<{ saved: boolean; filename: string }> {
  const token = await tokenStorage.get();
  const url = `${BASE_URL}/api${path}`;
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  if (Platform.OS === 'web') {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Export failed (${response.status})`);
    }
    const filename = filenameFromDisposition(
      response.headers.get('content-disposition'),
      fallbackName
    );
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
    return { saved: true, filename };
  }

  const file = await File.downloadFileAsync(url, new Directory(Paths.cache), { headers });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri);
  }
  return { saved: true, filename: fallbackName };
}
