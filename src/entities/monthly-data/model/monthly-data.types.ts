export interface RegionNode {
  regionPath: string;
  region: string;
  level: number;
  parentPath: string | null;
  children: RegionNode[];
}

export interface ResolvedRegion {
  requestedPath: string;
  resolvedPath: string;
  resolvedRegion: string;
  resolvedLevel: number;
  fallback: boolean;
}

export interface TimeseriesPoint {
  date: string; // YYYY-MM
  value: number | null;
}

export interface MonthlySeries {
  requestedPath: string;
  resolved: ResolvedRegion | null;
  data: TimeseriesPoint[];
}

export interface RegionCompareItem {
  regionPath: string;
  region: string;
  prev: number | null;
  curr: number | null;
  change: number | null;
}

export interface RegionCompareResult {
  date: string;
  prevDate: string;
  items: RegionCompareItem[];
}
