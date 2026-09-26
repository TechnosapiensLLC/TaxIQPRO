import { create } from 'zustand';

interface ScannedItem {
  barcode: string;
  name?: string;
  scannedAt: number;
}

interface ScanState {
  lastScan: ScannedItem | null;
  setScan: (barcode: string, name?: string) => void;
  clear: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
  lastScan: null,
  setScan: (barcode, name) => set({ lastScan: { barcode, name, scannedAt: Date.now() } }),
  clear: () => set({ lastScan: null }),
}));
