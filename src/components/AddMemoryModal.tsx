import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import EmojiPicker, { type EmojiClickData, Theme, EmojiStyle } from 'emoji-picker-react';
import { useMemoryStore } from '../store/memoryStore';
import { getMemoryImages, normalizePhonePhotoToDataUrl } from '../utils/imageUtils';
import { analyzePhoto, transcribeVoiceMemo } from '../utils/analyzePhoto';
import { getFirstReviewDate, toISODateString } from '../utils/spacedRepetition';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import { ConfirmDialog } from './ConfirmDialog';
import type { Memory, MemoryMood, PendingLatLng } from '../types/memory';
import { MEMORY_MOOD_OPTIONS, parseMemoryMood } from '../utils/memoryMoods';
import { NotionNotesEditor } from './NotionNotesEditor';
import {
  mergeAudioTranscriptionIntoNotes,
  parseNotesFrontMatter,
  serializeNotesFrontMatter,
} from '../utils/notesFrontMatter';
import { memoryNoteDisplayName, vaultTitleFilenameError } from '../utils/vaultMarkdown';
import { blobToDataUrl, isVoiceRecordingSupported, preferredVoiceMimeType } from '../utils/voiceNote';
import { VoiceNoteInlinePlayer } from './VoiceNoteInlinePlayer';

function generateId(): string {
  return crypto.randomUUID();
}

function formatLocationCoords(lat: number, lng: number): string {
  return `${lat}, ${lng}`;
}

function isLikelyPhotoFile(file: File): boolean {
  if (file.type.toLowerCase().startsWith('image/')) return true;
  const lower = file.name.toLowerCase();
  return (
    lower.endsWith('.heic') ||
    lower.endsWith('.heif') ||
    lower.endsWith('.avif') ||
    lower.endsWith('.dng') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp')
  );
}

async function resizeImageIfNeeded(dataUrl: string, maxPx: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      if (width <= maxPx && height <= maxPx) return resolve(dataUrl);
      const scale = maxPx / Math.max(width, height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

interface AddMemoryModalProps {
  pending: PendingLatLng | null;
  editingMemory: Memory | null;
  onClose: () => void;
}

export function AddMemoryModal({ pending, editingMemory, onClose }: AddMemoryModalProps) {
  const addMemory = useMemoryStore((s) => s.addMemory);
  const updateMemory = useMemoryStore((s) => s.updateMemory);
  const removeMemory = useMemoryStore((s) => s.removeMemory);
  const setEditingMemory = useMemoryStore((s) => s.setEditingMemory);
  const setDefaultGroupId = useMemoryStore((s) => s.setDefaultGroupId);
  const addGroup = useMemoryStore((s) => s.addGroup);
  const skipDeleteConfirmation = useMemoryStore((s) => s.skipDeleteConfirmation);
  const setSkipDeleteConfirmation = useMemoryStore((s) => s.setSkipDeleteConfirmation);
  const logStudyMemoryCreated = useMemoryStore((s) => s.logStudyMemoryCreated);
  const logStudyMemoryUpdated = useMemoryStore((s) => s.logStudyMemoryUpdated);
  const dateFilterFrom = useMemoryStore((s) => s.dateFilterFrom);
  const dateFilterTo = useMemoryStore((s) => s.dateFilterTo);
  const isEdit = !!editingMemory;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const existingFrontMatter = parseNotesFrontMatter(editingMemory?.notes ?? null);
  const notesBodyInitial = existingFrontMatter.body;
  const notesFrontMatterInitial = existingFrontMatter.frontMatter;
  const effectiveLat = editingMemory ? editingMemory.lat : pending?.lat ?? 0;
  const effectiveLng = editingMemory ? editingMemory.lng : pending?.lng ?? 0;
  const selectedCalendarDate =
    dateFilterFrom && dateFilterTo && dateFilterFrom === dateFilterTo ? dateFilterFrom : null;

  const [title, setTitle] = useState(editingMemory?.title ?? '');
  const [placeDescriptor, setPlaceDescriptor] = useState(editingMemory?.placeDescriptor ?? '');

  const initialDate =
    notesFrontMatterInitial.date ??
    editingMemory?.date ??
    selectedCalendarDate ??
    new Date().toISOString().slice(0, 10);
  const initialTags = notesFrontMatterInitial.tags ?? editingMemory?.tags ?? [];
  const initialLinks = notesFrontMatterInitial.links ?? editingMemory?.links ?? [];
  const initialLocationFallback = formatLocationCoords(effectiveLat, effectiveLng);

  const initialNotesFull = serializeNotesFrontMatter(
    { date: initialDate, location: initialLocationFallback, tags: initialTags, links: initialLinks },
    notesBodyInitial
  );

  const [notes, setNotes] = useState(initialNotesFull);
  const [imageDataUrls, setImageDataUrls] = useState<string[]>(() =>
    editingMemory ? getMemoryImages(editingMemory) : []
  );
  const defaultGroupId = useMemoryStore((s) => s.defaultGroupId);
  const [groupId, setGroupId] = useState<string | null>(
    editingMemory ? (editingMemory.groupId ?? null) : (defaultGroupId ?? null)
  );
  const [mood, setMood] = useState<MemoryMood | null>(() => parseMemoryMood(editingMemory?.mood) ?? null);
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(() => editingMemory?.audioDataUrl ?? null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [customLabel, setCustomLabel] = useState(editingMemory?.customLabel ?? '');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiPickerRect, setEmojiPickerRect] = useState<{ top: number; left: number } | null>(null);
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [vaultTitleError, setVaultTitleError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestedTitle, setAiSuggestedTitle] = useState(false);
  const [aiSuggestedLabel, setAiSuggestedLabel] = useState(false);
  const [aiSuggestedPlace, setAiSuggestedPlace] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const groups = useMemoryStore((s) => s.groups);
  const aiProvider = useMemoryStore((s) => s.aiProvider);
  const aiApiKey = useMemoryStore((s) => s.aiApiKey);
  useReverseGeocode(effectiveLat, effectiveLng);
  const locationForYaml = formatLocationCoords(effectiveLat, effectiveLng);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const voiceSupported = useMemo(() => isVoiceRecordingSupported(), []);
  const canSuggestWithAi =
    !!aiProvider && !!aiApiKey.trim() && (imageDataUrls.length > 0 || !!audioDataUrl?.trim());

  const stopMediaStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== 'inactive') {
        try {
          mr.stop();
        } catch {
          /* */
        }
      }
      mediaRecorderRef.current = null;
      stopMediaStream();
    };
  }, [stopMediaStream]);

  const toggleVoiceRecording = useCallback(async () => {
    setAudioError(null);
    if (isRecording) {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== 'inactive') mr.stop();
      return;
    }
    if (!voiceSupported) {
      setAudioError('Voice recording is not supported here.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = preferredVoiceMimeType();
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        setIsRecording(false);
        stopMediaStream();
        const parts = chunksRef.current;
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        if (parts.length === 0) return;
        try {
          const blob = new Blob(parts, { type: mr.mimeType || 'audio/webm' });
          const dataUrl = await blobToDataUrl(blob);
          setAudioDataUrl(dataUrl);
        } catch {
          setAudioError('Could not save recording.');
        }
      };
      mr.start(250);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch {
      setAudioError('Microphone permission denied or unavailable.');
      stopMediaStream();
    }
  }, [isRecording, voiceSupported, stopMediaStream]);

  // Note: we intentionally do NOT auto-rewrite YAML while the user is typing,
  // to avoid disrupting cursor/enter behavior. Location gets written on Save.
  useFocusTrap(modalRef, !!(pending || editingMemory));

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setUploadError(null);
      const toAdd: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!isLikelyPhotoFile(file)) {
          setUploadError('Please choose image files only.');
          continue;
        }
        try {
          const dataUrl = await normalizePhonePhotoToDataUrl(file);
          toAdd.push(dataUrl);
        } catch {
          setUploadError('Failed to process an image.');
        }
      }
      if (toAdd.length) {
        setImageDataUrls((prev) => [...prev, ...toAdd]);
      }
    },
    []
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const removeImageAt = (index: number) => {
    setImageDataUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const runAiSuggestion = useCallback(async () => {
    if (!aiProvider || !aiApiKey.trim()) return;
    const hasPhoto = imageDataUrls.length > 0;
    const hasAudio = !!audioDataUrl?.trim();
    if (!hasPhoto && !hasAudio) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const errs: string[] = [];
      if (hasPhoto) {
        try {
          const resized = await resizeImageIfNeeded(imageDataUrls[0], 900);
          const result = await analyzePhoto(resized, aiProvider, aiApiKey.trim());
          setTitle(result.title);
          setCustomLabel(result.emoji);
          setPlaceDescriptor(result.placeDescriptor);
          setAiSuggestedTitle(true);
          setAiSuggestedLabel(true);
          setAiSuggestedPlace(true);
          setVaultTitleError(null);
        } catch (e: unknown) {
          errs.push(e instanceof Error ? e.message : 'Photo analysis failed.');
        }
      }
      if (hasAudio) {
        try {
          const transcript = await transcribeVoiceMemo(audioDataUrl!, aiProvider, aiApiKey.trim());
          setNotes((prev) => mergeAudioTranscriptionIntoNotes(prev, transcript));
        } catch (e: unknown) {
          errs.push(e instanceof Error ? e.message : 'Transcription failed.');
        }
      }
      if (errs.length) setAiError(errs.join(' '));
    } finally {
      setAiLoading(false);
    }
  }, [aiProvider, aiApiKey, imageDataUrls, audioDataUrl]);

  const buildMemoryPayload = () => {
    const titleToSave =
      editingMemory?.importedFromPhoto && title.trim() === '' ? '' : (title.trim() || 'Untitled');
    const reservedErr = vaultTitleFilenameError(titleToSave);
    if (reservedErr) {
      setVaultTitleError(reservedErr);
      return null;
    }
    setVaultTitleError(null);
    const chosenGroupId = groupId || null;
    const firstImage = imageDataUrls[0] ?? null;
    const parsed = parseNotesFrontMatter(notes);
    const dateToSave = parsed.frontMatter.date ?? initialDate;
    const tagsToSave = parsed.frontMatter.tags ?? [];
    const linksToSave = parsed.frontMatter.links ?? [];
    const locationToSave = locationForYaml || initialLocationFallback;

    const notesFull = serializeNotesFrontMatter(
      { date: dateToSave, location: locationToSave, tags: tagsToSave, links: linksToSave },
      parsed.body
    );
    const tagsField = tagsToSave.length ? tagsToSave : undefined;
    const linksField = linksToSave.length ? linksToSave : undefined;
    const placeDescriptorField = placeDescriptor.trim().slice(0, 120) || undefined;
    return {
      titleToSave,
      dateToSave,
      notesFull,
      firstImage,
      chosenGroupId,
      tagsField,
      linksField,
      moodField: mood ?? undefined,
      audioField: audioDataUrl ?? undefined,
      placeDescriptorField,
    };
  };

  const handleSave = () => {
    const payload = buildMemoryPayload();
    if (!payload) return;
    if (editingMemory) {
      updateMemory(editingMemory.id, {
        title: payload.titleToSave,
        date: payload.dateToSave,
        notes: payload.notesFull,
        imageDataUrls: imageDataUrls.length ? imageDataUrls : undefined,
        imageDataUrl: payload.firstImage,
        groupId: payload.chosenGroupId,
        customLabel: customLabel.trim() || undefined,
        tags: payload.tagsField,
        links: payload.linksField,
        mood: payload.moodField,
        audioDataUrl: payload.audioField,
        placeDescriptor: payload.placeDescriptorField,
      });
      logStudyMemoryUpdated(editingMemory.id);
      setEditingMemory(null);
    } else if (pending) {
      const memory: Memory = {
        id: generateId(),
        lat: pending.lat,
        lng: pending.lng,
        title: payload.titleToSave,
        date: payload.dateToSave,
        notes: payload.notesFull,
        imageDataUrl: payload.firstImage,
        imageDataUrls: imageDataUrls.length ? imageDataUrls : undefined,
        createdAt: new Date().toISOString(),
        groupId: payload.chosenGroupId,
        customLabel: customLabel.trim() || undefined,
        tags: payload.tagsField,
        links: payload.linksField,
        mood: payload.moodField,
        audioDataUrl: payload.audioField,
        placeDescriptor: payload.placeDescriptorField,
        nextReviewAt: toISODateString(getFirstReviewDate()),
        reviewCount: 0,
      };
      addMemory(memory);
      logStudyMemoryCreated(memory.id);
      if (payload.chosenGroupId) setDefaultGroupId(payload.chosenGroupId);
    }
    onClose();
  };

  const handleClose = () => {
    if (editingMemory) {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      const payload = buildMemoryPayload();
      if (payload) {
        updateMemory(editingMemory.id, {
          title: payload.titleToSave,
          date: payload.dateToSave,
          notes: payload.notesFull,
          imageDataUrls: imageDataUrls.length ? imageDataUrls : undefined,
          imageDataUrl: payload.firstImage,
          groupId: payload.chosenGroupId,
          customLabel: customLabel.trim() || undefined,
          tags: payload.tagsField,
          links: payload.linksField,
          mood: payload.moodField,
          audioDataUrl: payload.audioField,
          placeDescriptor: payload.placeDescriptorField,
        });
      }
    }
    onClose();
  };

  useEffect(() => {
    if (!editingMemory) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      const payload = buildMemoryPayload();
      if (!payload) return;
      updateMemory(editingMemory.id, {
        title: payload.titleToSave,
        date: payload.dateToSave,
        notes: payload.notesFull,
        imageDataUrls: imageDataUrls.length ? imageDataUrls : undefined,
        imageDataUrl: payload.firstImage,
        groupId: payload.chosenGroupId,
        customLabel: customLabel.trim() || undefined,
        tags: payload.tagsField,
        links: payload.linksField,
        mood: payload.moodField,
        audioDataUrl: payload.audioField,
        placeDescriptor: payload.placeDescriptorField,
      });
    }, 280);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [
    editingMemory,
    title,
    notes,
    imageDataUrls,
    audioDataUrl,
    groupId,
    mood,
    customLabel,
    placeDescriptor,
    locationForYaml,
    initialDate,
    initialLocationFallback,
    updateMemory,
  ]);

  const handleDeleteConfirm = (dontAskAgain?: boolean) => {
    if (editingMemory) {
      if (dontAskAgain) setSkipDeleteConfirmation(true);
      removeMemory(editingMemory.id);
      setEditingMemory(null);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  const [open, setOpen] = useState(false);
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target as Node)) {
        setGroupDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => setOpen(true));
    });
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (!editingMemory?.importedFromPhoto) return;
    const id = window.setTimeout(() => titleInputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [editingMemory?.id, editingMemory?.importedFromPhoto]);

  useEffect(() => {
    if (!emojiPickerOpen || !iconButtonRef.current) return;
    const el = iconButtonRef.current;
    const updateRect = () => {
      const r = el.getBoundingClientRect();
      setEmojiPickerRect({ top: r.bottom + 8, left: r.left });
    };
    updateRect();
    const resizeObs = new ResizeObserver(updateRect);
    resizeObs.observe(el);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      resizeObs.disconnect();
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [emojiPickerOpen]);

  useEffect(() => {
    if (!emojiPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node) &&
        iconButtonRef.current && !iconButtonRef.current.contains(e.target as Node)
      ) {
        setEmojiPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [emojiPickerOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleClose]);

  if (!pending && !editingMemory) return null;

  return (
    <>
      {/* Same light scrim + right drawer for new memories and edits (matches edit UX). */}
      <div className="pointer-events-none fixed inset-0 z-[1100] bg-background/10" aria-hidden />
      <div
        ref={modalRef}
        className={`pointer-events-auto fixed inset-y-0 right-0 z-[1101] flex w-[min(540px,92vw)] sm:w-[min(620px,88vw)] lg:w-[min(780px,70vw)] xl:w-[min(860px,60vw)] flex-col rounded-l-xl border border-border bg-surface shadow-xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        role="dialog"
        aria-modal="true"
      >
        <div
          className={`flex flex-1 flex-col overflow-x-hidden p-4 py-6 overscroll-contain md:p-8 ${emojiPickerOpen ? 'overflow-y-hidden' : 'overflow-y-auto'}`}
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
        <div className="mb-2 flex items-start justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="touch-target flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full border border-border bg-surface/70 text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary active:opacity-80"
            aria-label="Close"
            title="Close"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-1 flex items-center gap-3">
          <div className="relative flex h-10 w-10 flex-shrink-0 md:h-12 md:w-12">
            <button
              ref={iconButtonRef}
              type="button"
              onClick={() => setEmojiPickerOpen((o) => !o)}
              className="flex h-full w-full items-center justify-center rounded-lg bg-surface-elevated text-xl font-semibold text-text-secondary transition-colors hover:bg-surface hover:text-accent md:text-2xl md:font-bold"
              title="Click to choose emoji"
              aria-label="Choose emoji"
            >
              {customLabel.trim() || '☺'}
            </button>
            {emojiPickerOpen &&
              emojiPickerRect &&
              createPortal(
                <div
                  ref={emojiPickerRef}
                  className="fixed z-[1110] rounded-lg border border-border bg-surface shadow-xl"
                  style={{ top: emojiPickerRect.top, left: emojiPickerRect.left }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <EmojiPicker
                    theme={Theme.DARK}
                    emojiStyle={EmojiStyle.GOOGLE}
                    searchPlaceHolder="Search emoji"
                    onEmojiClick={(emojiData: EmojiClickData) => {
                      setCustomLabel(emojiData.emoji);
                      setAiSuggestedLabel(false);
                      setEmojiPickerOpen(false);
                    }}
                    width={320}
                    height={360}
                    previewConfig={{ showPreview: false }}
                  />
                </div>,
                document.body
              )}
          </div>
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setVaultTitleError(null);
              setAiSuggestedTitle(false);
            }}
            placeholder="Name this memory..."
            className="font-display min-w-0 flex-1 border-none bg-transparent text-xl font-semibold text-text-primary placeholder-text-muted outline-none md:text-2xl md:font-bold"
            style={{ fontSize: 'min(1.25rem, 5vw)' }}
            aria-invalid={vaultTitleError ? true : undefined}
            aria-describedby={vaultTitleError ? 'vault-title-error' : undefined}
          />
          {aiSuggestedTitle && (
            <span className="ml-2 rounded-full border border-[#ef9f27]/50 bg-[#ef9f27]/15 px-2 py-0.5 font-mono text-[10px] text-[#efc26f]">
              AI suggested
            </span>
          )}
        </div>
        {editingMemory?.importedFromPhoto && !title.trim() && (
          <div className="mt-2 rounded-md border border-border bg-surface-elevated/70 px-3 py-2">
            <p className="font-mono text-[11px] text-text-secondary">
              Imported from photo · add a title to finish
            </p>
          </div>
        )}
        {vaultTitleError && (
          <p id="vault-title-error" className="mt-2 font-mono text-xs text-danger" role="alert">
            {vaultTitleError}
          </p>
        )}
        {aiError && (
          <p className="mt-2 font-mono text-xs text-danger" role="alert">
            {aiError}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-4">
          {/* shrink-0 + fixed max width so inner w-full cannot expand this flex item to 100% and squeeze mood to 0 width */}
          <div ref={groupDropdownRef} className="w-[200px] shrink-0">
            <label className="font-mono mb-1 block text-xs text-text-secondary">
              Group
            </label>
            <div className="relative w-full">
              <button
                type="button"
                onClick={() => setGroupDropdownOpen((o) => !o)}
                className={`font-mono w-full min-h-[44px] touch-target flex items-center justify-between gap-3 border border-border bg-surface-elevated/70 py-3 pl-3 pr-3 text-left text-base text-text-primary outline-none transition-colors hover:bg-surface-elevated md:py-2 md:text-sm ${
                  groupDropdownOpen ? 'rounded-t-lg rounded-b-none border-b-transparent' : 'rounded-lg'
                }`}
                aria-expanded={groupDropdownOpen}
                aria-haspopup="listbox"
                aria-label="Select group"
              >
                <span className="min-w-0 flex-1 truncate text-left">
                  {groupId ? groups.find((g) => g.id === groupId)?.name ?? 'Ungrouped' : 'Ungrouped'}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 transition-transform ${groupDropdownOpen ? 'rotate-180' : ''}`} aria-hidden>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {groupDropdownOpen && (
                <ul
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-10 mt-0 max-h-48 overflow-y-auto overflow-x-hidden rounded-b-lg border border-border border-t-0 bg-surface shadow-lg py-1"
                >
                  <li role="option" aria-selected={!groupId}>
                    <button
                      type="button"
                      onClick={() => {
                        setGroupId(null);
                        setGroupDropdownOpen(false);
                      }}
                      className={`font-mono w-full min-h-[44px] touch-target py-2.5 pl-3 pr-3 text-left text-sm transition-colors hover:bg-surface-elevated focus:outline-none ${
                        !groupId ? 'bg-accent/10 text-accent' : 'text-text-primary'
                      }`}
                    >
                      Ungrouped
                    </button>
                  </li>
                  {groups.map((g) => (
                    <li key={g.id} role="option" aria-selected={groupId === g.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setGroupId(g.id);
                          setGroupDropdownOpen(false);
                        }}
                        className={`font-mono w-full min-h-[44px] touch-target py-2.5 pl-3 pr-3 text-left text-sm transition-colors hover:bg-surface-elevated focus:outline-none ${
                          groupId === g.id ? 'bg-accent/10 text-accent' : 'text-text-primary'
                        }`}
                      >
                        {g.name}
                      </button>
                    </li>
                  ))}
                  <li className="border-t border-border mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const id = crypto.randomUUID();
                        addGroup({ id, name: 'Group', collapsed: false });
                        setGroupId(id);
                        setDefaultGroupId(id);
                        setGroupDropdownOpen(false);
                      }}
                      className="font-mono w-full min-h-[44px] touch-target py-2.5 pl-3 pr-3 text-left text-sm text-accent transition-colors hover:bg-surface-elevated focus:outline-none"
                    >
                      + New group
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>

          <div
            className="min-w-0 shrink-0 self-end"
            role="group"
            aria-label="Mood or emotion"
          >
            <label className="font-mono mb-1 block text-xs text-text-secondary">Mood</label>
            <div className="flex flex-wrap gap-2">
              {MEMORY_MOOD_OPTIONS.map((opt) => {
                const selected = mood === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    title={`${opt.label} — ${opt.description}`}
                    aria-label={`${opt.label}: ${opt.description}`}
                    aria-pressed={selected}
                    onClick={() => setMood((prev) => (prev === opt.id ? null : opt.id))}
                    className={`touch-target flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border text-xl transition-colors md:min-h-[40px] md:min-w-[40px] md:text-lg ${
                      selected
                        ? 'border-accent bg-accent/15 shadow-[0_0_0_3px_var(--color-accent-glow)] ring-2 ring-accent/50'
                        : 'border-border bg-surface-elevated/60 hover:border-accent/50 hover:bg-surface-elevated'
                    }`}
                  >
                    <span aria-hidden>{opt.emoji}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 flex-1 basis-[min(100%,16rem)] self-end">
            <label className="font-mono mb-1 block text-xs text-text-secondary">Voice</label>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void toggleVoiceRecording()}
                disabled={!voiceSupported}
                aria-pressed={isRecording}
                aria-label={isRecording ? 'Stop recording' : 'Record a voice note'}
                title={isRecording ? 'Stop recording' : 'Record a voice note'}
                className={`touch-target flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors md:h-10 md:w-10 ${
                  isRecording
                    ? 'border-danger bg-danger/15 text-danger'
                    : 'border-border bg-surface-elevated/80 text-text-primary hover:border-accent/50 hover:bg-surface-elevated'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  {isRecording ? (
                    <rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor" stroke="none" />
                  ) : (
                    <>
                      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
                      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3" strokeLinecap="round" />
                    </>
                  )}
                </svg>
              </button>
              <VoiceNoteInlinePlayer
                src={audioDataUrl}
                isRecording={isRecording}
                onClear={() => setAudioDataUrl(null)}
                className="min-w-0 flex-1 sm:min-w-[180px]"
              />
            </div>
          </div>
        </div>
        {canSuggestWithAi && (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void runAiSuggestion()}
              disabled={aiLoading}
              className="font-mono inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-border bg-surface-elevated/70 px-2.5 py-1 text-[11px] text-text-primary transition-colors hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aiLoading ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-text-muted border-t-transparent" />
                  Analyzing...
                </>
              ) : (
                <>
                  <span aria-hidden>✦</span>
                  Suggest with AI
                </>
              )}
            </button>
            {aiSuggestedLabel && (
              <span className="rounded-full border border-[#ef9f27]/50 bg-[#ef9f27]/15 px-2 py-0.5 font-mono text-[10px] text-[#efc26f]">
                AI suggested
              </span>
            )}
          </div>
        )}
        {(audioError || !voiceSupported) && (
          <div className="mt-2 space-y-1">
            {audioError && (
              <p className="max-w-[20rem] font-mono text-[10px] text-danger" role="alert">
                {audioError}
              </p>
            )}
            {!voiceSupported && (
              <p className="font-mono text-[10px] text-text-muted">Recording unavailable</p>
            )}
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => {
            if (imageDataUrls.length) {
              setImagePreviewOpen(true);
            } else {
              fileInputRef.current?.click();
            }
          }}
          className={`relative z-0 mt-5 flex h-[min(40vh,380px)] min-h-[160px] w-full cursor-pointer touch-target flex-col overflow-hidden rounded border-2 border-dashed transition-colors ${
            dragOver ? 'border-accent bg-accent-glow' : 'border-border bg-surface-elevated'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
            {imageDataUrls[0] ? (
              <img
                src={imageDataUrls[0]}
                alt="Preview"
                className="mx-auto block w-full max-w-full rounded object-contain pointer-events-none select-none"
              />
            ) : (
              <div className="flex h-full min-h-[108px] items-center justify-center px-3 py-4">
                <span className="text-center font-mono text-sm text-text-muted">
                  Drop photos or click to upload
                </span>
              </div>
            )}
            {uploadError && (
              <p className="shrink-0 px-3 pb-2 font-mono text-xs text-danger">{uploadError}</p>
            )}
          </div>
        </div>
        {imageDataUrls.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {imageDataUrls.map((url, i) => (
              <div key={i} className="relative">
                <img
                  src={url}
                  alt=""
                  className="h-14 w-14 rounded object-cover border border-border"
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeImageAt(i); }}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] text-white"
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {imagePreviewOpen && imageDataUrls.length > 0 && (
          <>
            <div
              className="fixed inset-0 z-[1102] bg-background/80 backdrop-blur-sm"
              onClick={() => setImagePreviewOpen(false)}
              aria-hidden
            />
            <div
              className="fixed inset-0 z-[1103] flex items-center justify-center p-4"
              onClick={() => setImagePreviewOpen(false)}
              role="dialog"
              aria-modal="true"
              aria-label="Image preview"
            >
              <div
                className="relative max-h-[85vh] max-w-[90vw] overflow-hidden rounded-lg border border-border bg-surface shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={imageDataUrls[0]}
                  alt="Preview"
                  className="max-h-[85vh] max-w-full object-contain"
                />
                <div className="flex flex-wrap gap-2 border-t border-border bg-surface p-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreviewOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="font-mono touch-target min-h-[40px] px-3 text-sm text-accent underline-offset-2 hover:underline"
                  >
                    Add more photos
                  </button>
                  <button
                    type="button"
                    onClick={() => setImagePreviewOpen(false)}
                    className="font-mono touch-target min-h-[40px] px-3 text-sm text-text-secondary hover:text-text-primary"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="mt-5 space-y-3">
          <div>
            <label className="font-mono mb-1 block text-xs text-text-secondary">Location</label>
            <input
              type="text"
              value={formatLocationCoords(effectiveLat, effectiveLng)}
              readOnly
              className="font-mono w-full rounded-lg border border-border bg-surface-elevated/70 px-3 py-2 text-sm text-text-secondary"
            />
          </div>
          <div>
            <label className="font-mono mb-1 block text-xs text-text-secondary">Sense of place</label>
            <input
              type="text"
              value={placeDescriptor}
              onChange={(e) => {
                setPlaceDescriptor(e.target.value.slice(0, 120));
                setAiSuggestedPlace(false);
              }}
              maxLength={120}
              placeholder="the wooden bench under the tree, afternoon light..."
              className="font-mono w-full rounded-lg border border-border bg-surface-elevated/70 px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-accent/60 focus:ring-1 focus:ring-accent/40"
            />
            {aiSuggestedPlace && (
              <span className="mt-1 inline-block rounded-full border border-[#ef9f27]/50 bg-[#ef9f27]/15 px-2 py-0.5 font-mono text-[10px] text-[#efc26f]">
                AI suggested
              </span>
            )}
          </div>
        </div>

        <NotionNotesEditor value={notes} onChange={setNotes} />

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {!isEdit && (
            <button
              type="button"
              onClick={handleSave}
              className="font-mono touch-target min-h-[44px] min-w-[120px] flex-1 bg-accent px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 active:opacity-95 md:flex-none md:py-2.5"
            >
              ARCHIVE MEMORY
            </button>
          )}
          {isEdit && (
            <p className="font-mono text-xs text-text-muted">
              Changes auto-save
            </p>
          )}
          {isEdit && (
            <button
              type="button"
              onClick={() => {
                if (skipDeleteConfirmation) {
                  handleDeleteConfirm();
                } else {
                  setShowDeleteConfirm(true);
                }
              }}
              className="touch-target flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center text-text-muted transition-colors hover:text-danger"
              aria-label="Delete memory"
              title="Delete memory"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          )}
        </div>
        </div>
      </div>
      <ConfirmDialog
        key={showDeleteConfirm ? 'open' : 'closed'}
        open={showDeleteConfirm}
        title="Delete memory"
        message={editingMemory ? `Delete "${memoryNoteDisplayName(editingMemory)}" from the atlas?` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        zIndex={1200}
        dontAskAgainLabel="Do not show this message again"
        onConfirm={(dontAskAgain) => handleDeleteConfirm(dontAskAgain)}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
