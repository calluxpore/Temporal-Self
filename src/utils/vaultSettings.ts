import type { TimelineLineStyle } from '../store/memoryStore';
import type { StudyCheckpointTag, StudyEvent } from '../types/study';

export type VaultSettings = {
  theme?: 'dark' | 'light';
  mapView?: { lat: number; lng: number; zoom: number } | null;
  hasChosenStartLocation?: boolean;
  defaultGroupId?: string | null;
  sidebarWidth?: number;
  skipDeleteConfirmation?: boolean;
  recallSessions?: { remembered: number; forgot: number }[];
  studyParticipantId?: string | null;
  studyCheckpointTag?: StudyCheckpointTag | null;
  studyCheckpointCompletedByParticipant?: Record<string, Partial<Record<StudyCheckpointTag, string>>>;
  studyEvents?: StudyEvent[];
  timelineEnabled?: boolean;
  timelineLineStyle?: TimelineLineStyle;
  filterStarred?: boolean;
  sortBy?: 'default' | 'date' | 'title' | 'location' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  dateFilterFrom?: string | null;
  dateFilterTo?: string | null;
  heatmapEnabled?: boolean;
  markersVisible?: boolean;
  sidebarView?: 'list' | 'calendar' | 'stats' | 'memoryStats';
};

export function buildVaultSettingsFromState(
  s: {
    theme: 'dark' | 'light';
    mapView: { lat: number; lng: number; zoom: number } | null;
    hasChosenStartLocation: boolean;
    defaultGroupId: string | null;
    sidebarWidth: number;
    skipDeleteConfirmation: boolean;
    recallSessions: { remembered: number; forgot: number }[];
    studyParticipantId: string | null;
    studyCheckpointTag: StudyCheckpointTag | null;
    studyCheckpointCompletedByParticipant: Record<string, Partial<Record<StudyCheckpointTag, string>>>;
    studyEvents: StudyEvent[];
    timelineEnabled: boolean;
    timelineLineStyle: TimelineLineStyle;
    filterStarred: boolean;
    sortBy: 'default' | 'date' | 'title' | 'location' | 'createdAt';
    sortOrder: 'asc' | 'desc';
    dateFilterFrom: string | null;
    dateFilterTo: string | null;
    heatmapEnabled: boolean;
    markersVisible: boolean;
    sidebarView: 'list' | 'calendar' | 'stats' | 'memoryStats';
  }
): VaultSettings {
  return {
    theme: s.theme,
    mapView: s.mapView,
    hasChosenStartLocation: s.hasChosenStartLocation,
    defaultGroupId: s.defaultGroupId,
    sidebarWidth: s.sidebarWidth,
    skipDeleteConfirmation: s.skipDeleteConfirmation,
    recallSessions: s.recallSessions,
    studyParticipantId: s.studyParticipantId,
    studyCheckpointTag: s.studyCheckpointTag,
    studyCheckpointCompletedByParticipant: s.studyCheckpointCompletedByParticipant,
    studyEvents: s.studyEvents,
    timelineEnabled: s.timelineEnabled,
    timelineLineStyle: s.timelineLineStyle,
    filterStarred: s.filterStarred,
    sortBy: s.sortBy,
    sortOrder: s.sortOrder,
    dateFilterFrom: s.dateFilterFrom,
    dateFilterTo: s.dateFilterTo,
    heatmapEnabled: s.heatmapEnabled,
    markersVisible: s.markersVisible,
    sidebarView: s.sidebarView,
  };
}

export function normalizeVaultSettings(raw: unknown): VaultSettings {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const mapViewRaw = o.mapView && typeof o.mapView === 'object' ? (o.mapView as Record<string, unknown>) : null;
  const mapView =
    mapViewRaw &&
    typeof mapViewRaw.lat === 'number' &&
    typeof mapViewRaw.lng === 'number' &&
    typeof mapViewRaw.zoom === 'number'
      ? { lat: mapViewRaw.lat, lng: mapViewRaw.lng, zoom: mapViewRaw.zoom }
      : mapViewRaw === null
        ? null
        : undefined;

  const recallSessions = Array.isArray(o.recallSessions)
    ? o.recallSessions
        .map((x) => {
          if (!x || typeof x !== 'object') return null;
          const r = x as Record<string, unknown>;
          return typeof r.remembered === 'number' && typeof r.forgot === 'number'
            ? { remembered: r.remembered, forgot: r.forgot }
            : null;
        })
        .filter((x): x is { remembered: number; forgot: number } => x != null)
    : undefined;

  return {
    theme: o.theme === 'light' ? 'light' : o.theme === 'dark' ? 'dark' : undefined,
    mapView,
    hasChosenStartLocation:
      typeof o.hasChosenStartLocation === 'boolean' ? o.hasChosenStartLocation : undefined,
    defaultGroupId:
      typeof o.defaultGroupId === 'string' ? o.defaultGroupId : o.defaultGroupId === null ? null : undefined,
    sidebarWidth: typeof o.sidebarWidth === 'number' ? o.sidebarWidth : undefined,
    skipDeleteConfirmation:
      typeof o.skipDeleteConfirmation === 'boolean' ? o.skipDeleteConfirmation : undefined,
    recallSessions,
    studyParticipantId:
      'studyParticipantId' in o ? (typeof o.studyParticipantId === 'string' ? o.studyParticipantId : null) : undefined,
    studyCheckpointTag:
      'studyCheckpointTag' in o
        ? (typeof o.studyCheckpointTag === 'string' ? (o.studyCheckpointTag as StudyCheckpointTag) : null)
        : undefined,
    studyCheckpointCompletedByParticipant:
      o.studyCheckpointCompletedByParticipant &&
      typeof o.studyCheckpointCompletedByParticipant === 'object' &&
      !Array.isArray(o.studyCheckpointCompletedByParticipant)
        ? (o.studyCheckpointCompletedByParticipant as Record<
            string,
            Partial<Record<StudyCheckpointTag, string>>
          >)
        : undefined,
    studyEvents: Array.isArray(o.studyEvents) ? (o.studyEvents as StudyEvent[]) : undefined,
    timelineEnabled: typeof o.timelineEnabled === 'boolean' ? o.timelineEnabled : undefined,
    timelineLineStyle:
      o.timelineLineStyle === 'spline' || o.timelineLineStyle === 'orthogonal'
        ? o.timelineLineStyle
        : undefined,
    filterStarred: typeof o.filterStarred === 'boolean' ? o.filterStarred : undefined,
    sortBy:
      o.sortBy === 'default' ||
      o.sortBy === 'date' ||
      o.sortBy === 'title' ||
      o.sortBy === 'location' ||
      o.sortBy === 'createdAt'
        ? o.sortBy
        : undefined,
    sortOrder: o.sortOrder === 'asc' || o.sortOrder === 'desc' ? o.sortOrder : undefined,
    dateFilterFrom: typeof o.dateFilterFrom === 'string' ? o.dateFilterFrom : o.dateFilterFrom === null ? null : undefined,
    dateFilterTo: typeof o.dateFilterTo === 'string' ? o.dateFilterTo : o.dateFilterTo === null ? null : undefined,
    heatmapEnabled: typeof o.heatmapEnabled === 'boolean' ? o.heatmapEnabled : undefined,
    markersVisible: typeof o.markersVisible === 'boolean' ? o.markersVisible : undefined,
    sidebarView:
      o.sidebarView === 'list' ||
      o.sidebarView === 'calendar' ||
      o.sidebarView === 'stats' ||
      o.sidebarView === 'memoryStats'
        ? o.sidebarView
        : undefined,
  };
}
