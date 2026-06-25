export interface Source {
  url: string;
  title: string;
  content: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  subQuestions?: string[];
  phase?: "searching" | "reading" | "writing" | "verifying" | "done";
  hasContradictions?: boolean;
  verificationNotes?: string[];
}

export interface ResearchResponse {
  answer: string;
  sources: Source[];
  sub_questions_used: string[];
  has_contradictions: boolean;
  verification_notes: string[];
}
