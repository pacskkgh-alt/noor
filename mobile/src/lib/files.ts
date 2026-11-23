// شكل الملف كما يرسله الخادم
export type SeriesInfo = { idx: number; description: string; modality: string; count: number; frames: number; images: number };
export type NoorFile = {
  id: string; title: string; category: string; kind: 'pdf' | 'image' | 'video' | 'dicom';
  examDate?: string; center?: string; notes?: string; size: number; originalName?: string; createdAt: string;
  processing?: boolean; notesCount?: number; mime?: string;
  seriesCount?: number; imageCount?: number; modalities?: string[]; series?: SeriesInfo[];
  attachments?: { id: string; originalName: string; size: number }[];
};
export const CATS = ['imaging', 'lab', 'report', 'prescription', 'other'];
