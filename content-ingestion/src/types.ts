export type ExamCode = 'CUET_UG' | 'CUET_PG';

export interface OfficialPaper {
  exam: ExamCode;
  year: number;
  code: string;
  name: string;
  categoryCode: string;
  officialSyllabusUrl: string;
  listedOnUrl: string;
}

export interface Registry {
  generatedAt: string;
  year: number;
  sources: { exam: ExamCode; pages: string[]; bulletinUrl: string }[];
  papers: OfficialPaper[];
}

/** One line of document text in reading order, from the PDF text layer or from OCR. */
export interface SourceLine {
  page: number;
  y: number;
  x: number;
  text: string;
  runs?: { x: number; width: number; text: string }[];
  ocrConfidence?: number;
}

export type NodeKind = 'PART' | 'SECTION' | 'COURSE' | 'UNIT' | 'CHAPTER' | 'TOPIC' | 'SUBTOPIC' | 'ITEM' | 'NOTE';

export interface ExtractedNode {
  ref: string;
  parentRef: string | null;
  kind: NodeKind;
  label: string | null;
  title: string;
  body: string | null;
  position: number;
  depth: number;
  sourcePage: number | null;
  /** The heading line exactly as printed, e.g. "Unit II: Nutrition" (title and label are parsed from it). */
  sourceText?: string;
  /** Last page that contributed text to this node (its text can run onto later pages). */
  endPage?: number | null;
  flags: string[];
}

export interface ExtractedTable {
  nodeRef: string | null;
  page: number;
  rows: string[][];
}

export interface ExtractedFigure {
  nodeRef: string | null;
  page: number;
  sha256: string;
  width: number;
  height: number;
  localFile: string;
  byteSize: number;
}

export type DocStatus = 'EXTRACTED' | 'BLOCKED' | 'FAILED';

export interface ExtractionResult {
  paper: OfficialPaper;
  status: DocStatus;
  reason: string | null;
  source: {
    url: string;
    listedOnUrl: string;
    title: string;
    retrievedAt: string;
    sha256: string;
    byteSize: number;
    pageCount: number;
    localFile: string;
  } | null;
  method: 'text_layer' | 'ocr' | 'text_layer+ocr' | null;
  nodes: ExtractedNode[];
  tables: ExtractedTable[];
  figures: ExtractedFigure[];
  documentFlags: string[];
  /** Problems a reviewer must look at (sequence gaps, lost symbols, unsupported scripts, ...). */
  issues: string[];
  ocrPages: number[];
  /** Pages whose text was taken from Poppler's pdftotext because pdf.js garbled them (visual-order Devanagari). */
  popplerPages?: number[];
  reviewImages: string[];
  /** Raw OCR text per OCR'd page, kept for reconciliation and for human transcribers. */
  ocrText?: { page: number; meanConfidence: number; text: string }[];
  quality: {
    lines: number;
    unparsedLines: number;
    ocrLines: number;
    ocrLowConfidenceLines: number;
    meanOcrConfidence: number | null;
  };
}
