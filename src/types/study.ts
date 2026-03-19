export type StudyCheckpointTag = 'baseline' | '2d' | '14d' | '40d';

export type StudyEventType =
  | 'checkpoint_completed'
  | 'memory_created'
  | 'memory_updated'
  | 'recall_session_started'
  | 'recall_answered'
  | 'date_filter_changed';

export type StudyRecallAnswer = 'remember' | 'show_me' | 'skip';

export type StudyEvent =
  | {
      id: string;
      ts: string;
      type: 'checkpoint_completed';
      participantId: string | null;
      checkpointTag: StudyCheckpointTag;
    }
  | {
      id: string;
      ts: string;
      type: 'memory_created' | 'memory_updated';
      participantId: string | null;
      checkpointTag: StudyCheckpointTag | null;
      memoryId: string;
    }
  | {
      id: string;
      ts: string;
      type: 'recall_session_started';
      participantId: string | null;
      checkpointTag: StudyCheckpointTag | null;
      dueCount: number;
    }
  | {
      id: string;
      ts: string;
      type: 'recall_answered';
      participantId: string | null;
      checkpointTag: StudyCheckpointTag | null;
      memoryId: string;
      answer: StudyRecallAnswer;
    }
  | {
      id: string;
      ts: string;
      type: 'date_filter_changed';
      participantId: string | null;
      checkpointTag: StudyCheckpointTag | null;
      from: string | null;
      to: string | null;
    };

