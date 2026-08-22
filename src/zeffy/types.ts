export interface ZeffyQuestion {
  question: string;
  type: string;
  answer: string | string[];
}

export interface ZeffyItem {
  id: string;
  type: string;
  questions: ZeffyQuestion[];
}

export interface ZeffyPayloadData {
  id: string;
  status: string;
  campaign_id: string;
  // Event title set in Zeffy (e.g. "2026 Spring Qur'an Competition"). The
  // one shared webhook receives every form's submissions; this is how we tell
  // which competition a payload belongs to (stable across a competition's forms).
  description?: string;
  buyer: Record<string, unknown>;
  items: ZeffyItem[];
}

export interface ZeffyPayload {
  id: string;
  type: string;
  data: ZeffyPayloadData;
}

export interface ParsedFields {
  byLabel: Record<string, string | string[]>;
  fullName: string | null;
  gender: 'male' | 'female' | null;
  dateOfBirth: string | null;
  categories: string[];
}
