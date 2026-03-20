import type { StudyCheckpointTag } from '../types/study';

/** Human-readable label for a study checkpoint (matches Stats UI). */
export function studyCheckpointLabel(tag: StudyCheckpointTag): string {
  switch (tag) {
    case 'baseline':
      return 'Baseline';
    case '2d':
      return '2D';
    case '14d':
      return '2W';
    case '40d':
      return '40D';
    default:
      return tag;
  }
}
