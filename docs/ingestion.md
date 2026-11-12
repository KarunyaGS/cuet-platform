# Syllabus ingestion

Pipeline: **discover → download → extract → normalise → validate → deduplicate → (import) → verify.**
All steps are deterministic. No language model reads, rewrites or completes syllabus text.

## Discover
Reads the official NTA pages (`cuet.nta.nic.in/cuetug-2026-syllabus/` and the six
`exams.nta.nic.in/cuet-pg/syllabus/<family>/` pages), lists every paper with its PDF link, then checks the
codes against the Information Bulletin of the same cycle. Output:
`content-ingestion/registry/cuet-2026-official-papers.json` and `...-paper-list-checks.json`.

## Download
Retries with back-off, a polite delay, PDF signature check, SHA-256, cached under `storage/cache/pdf`.

## Extract
- **Text pages**: pdf.js text layer. Two-column pages are split at the right column's left edge.
  Tables are rows of 3+ word cells that line up across rows. Figures are embedded images that are
  large enough, not backgrounds repeated across pages and not on title pages.
- **Pages read by local OCR** (Tesseract via tesseract.js, models cached under `storage/cache/tessdata`):
  scanned pages, pages whose text is drawn as images or vector outlines, and pages typed in legacy
  non-Unicode fonts (Kruti Dev, old Gurmukhi fonts) whose text layer is garbage. The OCR language comes
  from the paper (e.g. Malayalam -> `mal`), with overrides checked by looking at the rendered pages.
  Each OCR'd page is saved as an image in `storage/local/review-pages` for human checking.
- **Structure**: headings by wording ("Unit", "Chapter", "Section", इकाई, اکائی ...), numbering (1., (ii),
  b., ༡༽ ...), bullets, and - flagged as inferred - by formatting. The printed heading line is kept as
  `sourceText`; nothing is reworded.

## Validate
Hard checks (parent links, depths, page ranges, lengths) block a document. Review flags (sequence gaps,
lost symbols, formulas, OCR confidence, unsupported scripts) are recorded per document.

## Audit
`npm run ingest -- audit` re-reads every PDF and reports, per paper and per page, the share of source words
captured in the extracted rows, an independent cross-check against `pdftotext`, duplicates, sequence gaps,
OCR confidence and classification. Nothing is ever marked verified by a machine.

## Text-layer problems the pipeline handles
- **Legacy fonts** (Kruti Dev, old Gurmukhi fonts): the text layer holds Latin letters standing in for
  Devanagari/Gurmukhi. Detected by in-word case/symbol patterns; those pages are read by OCR.
- **Visual-order Devanagari**: pdf.js returns some Devanagari fonts with the vowel sign ि before its
  consonant ("किव" for "कवि"). Detected; those pages come from Poppler's pdftotext when it reads them
  correctly, otherwise from Sanskrit/Hindi OCR.

## Known blockers (need a person)
- **Kashmiri (LAQP17)** and **Urdu (LAQP37)**: the syllabus body is a scanned image in Nastaliq script.
  Tesseract has no Kashmiri model, and its Urdu model reads Nastaliq as noise. Needs human transcription
  from the saved page images. See `content-ingestion/registry/source-issues.json` for other source problems.
