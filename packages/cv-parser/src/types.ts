/** A positioned piece of text from pdf.js or OCR. Coordinates are page units with y growing downward. */
export type TextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  /** Roughly the font size. */
  height: number;
  page: number;
  bold?: boolean;
};

export type Line = {
  text: string;
  page: number;
  y: number;
  x: number;
  fontSize: number;
  bold: boolean;
  bullet: boolean;
  /** Explicit heading markup (DOCX h1–h6). */
  heading: boolean;
  column: number;
};

export type LineInput = Partial<Omit<Line, 'text'>> & { text: string };

export type CvInput =
  | { kind: 'items'; items: TextItem[] }
  | { kind: 'lines'; lines: LineInput[] }
  | { kind: 'html'; html: string }
  | { kind: 'text'; text: string };

export type SectionKind =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'languages'
  | 'certifications'
  | 'references'
  | 'interests'
  | 'other';

/** A parsed value with a 0–1 confidence and the CV line it came from. */
export type Scored<T> = { value: T; confidence: number; source: string | null };

export type ParsedEducation = {
  degree: string | null;
  fieldOfStudy: string | null;
  institution: string | null;
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  grade: string | null;
  description: string | null;
  confidence: number;
  source: string;
};

export type ParsedExperience = {
  jobTitle: string | null;
  company: string | null;
  location: string | null;
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  description: string | null;
  confidence: number;
  source: string;
};

export type ParsedSkill = { name: string; confidence: number; source: string | null };

export type ParsedSection = {
  kind: SectionKind;
  heading: string;
  text: string;
  confidence: number;
};

export type ReviewArea = 'contact' | 'summary' | 'education' | 'experience' | 'skills';

export type ParsedCv = {
  version: number;
  contact: {
    fullName: Scored<string | null>;
    email: Scored<string | null>;
    phone: Scored<string | null>;
    location: Scored<string | null>;
    links: string[];
  };
  summary: Scored<string | null>;
  education: ParsedEducation[];
  experience: ParsedExperience[];
  skills: ParsedSkill[];
  languages: string[];
  certifications: string[];
  sections: ParsedSection[];
  confidence: Record<ReviewArea, number>;
  stats: { lines: number; columns: number; characters: number };
};

export type ParseOptions = {
  /** Extra canonical skill names (e.g. the platform's job skills). */
  extraSkills?: string[];
  /** ISO 3166 code for phone numbers written without a country prefix, e.g. "CM". */
  defaultCountry?: string;
  /** Reference date for "Present" and year sanity checks (tests pass a fixed date). */
  now?: Date;
};

/** The JSON shape stored in UploadMedia.cvExtractedText (read by job matching and career skills). */
export type StructuredCv = {
  fullName: string | null;
  summary: string | null;
  skills: string[];
  education: Array<Omit<ParsedEducation, 'confidence' | 'source'>>;
  experience: Array<Omit<ParsedExperience, 'confidence' | 'source'>>;
};
