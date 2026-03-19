import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import EmojiPicker, { type EmojiClickData, Theme, EmojiStyle } from 'emoji-picker-react';
import { useMemoryStore } from '../store/memoryStore';
import { compressImageToDataUrl, getMemoryImages } from '../utils/imageUtils';
import { formatCoords } from '../utils/formatCoords';
import { getFirstReviewDate, toISODateString } from '../utils/spacedRepetition';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import { ConfirmDialog } from './ConfirmDialog';
import type { Memory, PendingLatLng } from '../types/memory';

function generateId(): string {
  return crypto.randomUUID();
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
  const effectiveLat = editingMemory ? editingMemory.lat : pending?.lat ?? 0;
  const effectiveLng = editingMemory ? editingMemory.lng : pending?.lng ?? 0;
  const selectedCalendarDate =
    dateFilterFrom && dateFilterTo && dateFilterFrom === dateFilterTo ? dateFilterFrom : null;

  const [title, setTitle] = useState(editingMemory?.title ?? '');
  const [notes, setNotes] = useState(editingMemory?.notes ?? '');
  const [date, setDate] = useState(
    () =>
      editingMemory?.date ??
      selectedCalendarDate ??
      new Date().toISOString().slice(0, 10)
  );
  const [imageDataUrls, setImageDataUrls] = useState<string[]>(() =>
    editingMemory ? getMemoryImages(editingMemory) : []
  );
  const [mainImageFocus, setMainImageFocus] = useState<'top' | 'center'>('center');
  const defaultGroupId = useMemoryStore((s) => s.defaultGroupId);
  const [groupId, setGroupId] = useState<string | null>(
    editingMemory ? (editingMemory.groupId ?? null) : (defaultGroupId ?? null)
  );
  const [customLabel, setCustomLabel] = useState(editingMemory?.customLabel ?? '');
  const [tags, setTags] = useState<string[]>(() => editingMemory?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [links, setLinks] = useState<string[]>(() => editingMemory?.links ?? []);
  const [linkInput, setLinkInput] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiPickerRect, setEmojiPickerRect] = useState<{ top: number; left: number } | null>(null);
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const groups = useMemoryStore((s) => s.groups);
  const { location, loading: locationLoading } = useReverseGeocode(effectiveLat, effectiveLng);
  useFocusTrap(modalRef, !!(pending || editingMemory));

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setUploadError(null);
      const toAdd: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          setUploadError('Please choose image files only.');
          continue;
        }
        try {
          const dataUrl = await compressImageToDataUrl(file);
          toAdd.push(dataUrl);
        } catch {
          setUploadError('Failed to process an image.');
        }
      }
      if (toAdd.length) {
        setImageDataUrls((prev) => [...prev, ...toAdd]);
        setMainImageFocus('center');
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
    setMainImageFocus('center');
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput('');
  };

  const addLink = () => {
    const u = linkInput.trim();
    if (u && !links.includes(u)) setLinks((prev) => [...prev, u]);
    setLinkInput('');
  };

  const handleSave = () => {
    const chosenGroupId = groupId || null;
    const firstImage = imageDataUrls[0] ?? null;
    const tagsToSave = tags.length ? tags : undefined;
    const linksToSave = links.length ? links : undefined;
    if (editingMemory) {
      updateMemory(editingMemory.id, {
        title: title.trim() || 'Untitled',
        date,
        notes: notes.trim(),
        imageDataUrls: imageDataUrls.length ? imageDataUrls : undefined,
        imageDataUrl: firstImage,
        groupId: chosenGroupId,
        customLabel: customLabel.trim() || undefined,
        tags: tagsToSave,
        links: linksToSave,
      });
      logStudyMemoryUpdated(editingMemory.id);
      setEditingMemory(null);
    } else if (pending) {
      const memory: Memory = {
        id: generateId(),
        lat: pending.lat,
        lng: pending.lng,
        title: title.trim() || 'Untitled',
        date,
        notes: notes.trim(),
        imageDataUrl: firstImage,
        imageDataUrls: imageDataUrls.length ? imageDataUrls : undefined,
        createdAt: new Date().toISOString(),
        groupId: chosenGroupId,
        customLabel: customLabel.trim() || undefined,
        tags: tagsToSave,
        links: linksToSave,
        nextReviewAt: toISODateString(getFirstReviewDate()),
        reviewCount: 0,
      };
      addMemory(memory);
      logStudyMemoryCreated(memory.id);
      if (chosenGroupId) setDefaultGroupId(chosenGroupId);
    }
    onClose();
  };

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
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!pending && !editingMemory) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[1100] bg-background/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={modalRef}
        className={`modal-slide-up fixed inset-0 z-[1101] flex flex-col bg-surface md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[90vh] md:w-full md:max-w-lg md:rounded border border-border md:shadow-xl ${open ? 'open' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div
          className={`flex flex-1 flex-col overflow-x-hidden p-4 py-6 overscroll-contain md:p-8 ${emojiPickerOpen ? 'overflow-y-hidden' : 'overflow-y-auto'}`}
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
        <div className="mb-4 flex flex-col gap-2">
          {(location || locationLoading) && (
            <p className="font-mono text-sm leading-snug text-text-primary" title={location ?? undefined}>
              {locationLoading ? '…' : location}
            </p>
          )}
          <p className="font-mono text-sm text-accent">
            {formatCoords(effectiveLat, effectiveLng)}
          </p>
        </div>

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
          className={`mt-4 flex min-h-[120px] aspect-video w-full cursor-pointer touch-target flex-col items-center justify-center rounded border-2 border-dashed transition-colors ${
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
          {imageDataUrls[0] ? (
            <img
              src={imageDataUrls[0]}
              alt="Preview"
              className="h-full w-full rounded object-cover pointer-events-none"
              style={{ objectPosition: mainImageFocus === 'top' ? 'top' : 'center' }}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalHeight > img.naturalWidth) setMainImageFocus('top');
              }}
            />
          ) : (
            <span className="font-mono text-sm text-text-muted">
              Drop photos or click to upload
            </span>
          )}
          {uploadError && (
            <p className="mt-2 font-mono text-xs text-danger">{uploadError}</p>
          )}
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

        <div className="mt-6 flex items-center gap-3">
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
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name this memory..."
            className="font-display min-w-0 flex-1 border-none bg-transparent text-xl font-semibold text-text-primary placeholder-text-muted outline-none md:text-2xl md:font-bold"
            style={{ fontSize: 'min(1.25rem, 5vw)' }}
          />
        </div>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="font-mono mt-4 w-full max-w-[200px] min-h-[44px] touch-target border-b border-border bg-transparent py-3 text-base text-text-primary outline-none md:py-2 md:text-sm"
        />

        <div className="mt-4" ref={groupDropdownRef}>
          <label className="font-mono mb-1 block text-xs text-text-secondary">
            Group
          </label>
          <div className="relative w-full max-w-[200px]">
            <button
              type="button"
              onClick={() => setGroupDropdownOpen((o) => !o)}
              className="font-mono w-full min-h-[44px] touch-target flex items-center justify-between gap-3 border-b border-border bg-surface-elevated/50 py-3 pl-3 pr-3 text-left text-base text-text-primary outline-none transition-colors hover:bg-surface-elevated md:py-2 md:text-sm"
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
                className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded border border-border bg-surface shadow-lg py-1"
              >
                <li role="option" aria-selected={!groupId}>
                  <button
                    type="button"
                    onClick={() => {
                      setGroupId(null);
                      setGroupDropdownOpen(false);
                    }}
                    className={`font-mono w-full min-h-[44px] touch-target py-2.5 pl-3 pr-3 text-left text-sm transition-colors hover:bg-surface-elevated focus:outline-none ${!groupId ? 'bg-surface-elevated text-accent' : 'text-text-primary'}`}
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
                      className={`font-mono w-full min-h-[44px] touch-target py-2.5 pl-3 pr-3 text-left text-sm transition-colors hover:bg-surface-elevated focus:outline-none ${groupId === g.id ? 'bg-surface-elevated text-accent' : 'text-text-primary'}`}
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
                      addGroup({ id, name: 'New group', collapsed: false });
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

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What happened here..."
          rows={4}
          className="font-body mt-4 w-full resize-none border-none bg-transparent text-base text-text-primary placeholder-text-muted outline-none"
        />

        <div className="mt-4">
          <label className="font-mono mb-1 block text-xs text-text-secondary">Tags</label>
          <div className="flex flex-wrap items-center gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded bg-surface-elevated px-2 py-0.5 font-mono text-xs text-text-primary"
              >
                {t}
                <button
                  type="button"
                  onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                  className="touch-target -mr-0.5 flex h-5 w-5 items-center justify-center rounded text-text-muted hover:text-danger"
                  aria-label={`Remove tag ${t}`}
                >
                  ×
                </button>
              </span>
            ))}
            <div className="flex min-w-[120px] flex-1 items-center gap-1">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add tag..."
                className="font-mono min-h-[32px] flex-1 rounded border border-border bg-transparent px-2 text-xs text-text-primary placeholder-text-muted outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={addTag}
                className="font-mono touch-target min-h-[32px] px-2 text-xs text-accent hover:underline"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="font-mono mb-1 block text-xs text-text-secondary">Links</label>
          <div className="flex flex-wrap items-center gap-2">
            {links.map((url, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded bg-surface-elevated px-2 py-0.5 font-mono text-xs text-text-primary"
              >
                <a href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer" className="truncate max-w-[160px] text-accent hover:underline">
                  {url}
                </a>
                <button
                  type="button"
                  onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                  className="touch-target -mr-0.5 flex h-5 w-5 items-center justify-center rounded text-text-muted hover:text-danger"
                  aria-label="Remove link"
                >
                  ×
                </button>
              </span>
            ))}
            <div className="flex min-w-[120px] flex-1 items-center gap-1">
              <input
                type="url"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())}
                placeholder="https://..."
                className="font-mono min-h-[32px] flex-1 rounded border border-border bg-transparent px-2 text-xs text-text-primary placeholder-text-muted outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={addLink}
                className="font-mono touch-target min-h-[32px] px-2 text-xs text-accent hover:underline"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="font-mono touch-target min-h-[44px] min-w-[120px] flex-1 bg-accent px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 active:opacity-95 md:flex-none md:py-2.5"
          >
            {isEdit ? 'SAVE CHANGES' : 'ARCHIVE MEMORY'}
          </button>
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
        message={editingMemory ? `Delete "${editingMemory.title || 'Untitled'}" from the atlas?` : ''}
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
