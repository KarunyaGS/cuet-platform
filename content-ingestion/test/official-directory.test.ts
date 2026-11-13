import { describe, expect, it } from 'vitest';
import { parseKeyPage, parseKeyText } from '../src/official-directory';

// Headings in the two layouts NTA uses. The id numbers below are made up; only the layout is copied.
const UG = (date: string, shift: string, subject: string, rows: string) => `Exam Date: ${date} (${shift})        NATIONAL TESTING AGENCY

                                    CUET (UG) 2026 : Final Answer Keys

                               Subject : ${subject}

  Question Id.    Key                           Question Id.    Key
${rows}`;
const PG = (subject: string, shift: number, date: string) => `                            NATIONAL TESTING AGENCY

               Common University Entrance Test (PG) - CUET (PG) - 2025

                                            Final Answer Key

                                       Subject: ${subject}

Exam Shift: ${shift}                                                                  Exam Date: ${date}
 Question ID   Correct Option ID
 DROP: Marks awarded to all candidates
 1000000001    10000000011
`;

describe('reading an official answer-key page', () => {
  it('reads the CUET (UG) heading', () => {
    expect(parseKeyPage(UG('12-05-2026', 'Second', '322 - Physics', '111111111111    2222222222222'))).toEqual({ date: '2026-05-12', shift: 'Shift 2', subjectCode: '322', subjectName: 'Physics' });
    expect(parseKeyPage('Exam Date: 11-05-2026 (Second) Subject : 308 - Computer Science and Informatics Practices\n')).toEqual({ date: '2026-05-11', shift: 'Shift 2', subjectCode: '308', subjectName: 'Computer Science and Informatics Practices' });
  });
  it('reads the CUET (PG) heading', () => {
    expect(parseKeyPage(PG('ACQP01 - Shiksha Shastri B.Ed', 3, '27.03.2025'))).toEqual({ date: '2025-03-27', shift: 'Shift 3', subjectCode: 'ACQP01', subjectName: 'Shiksha Shastri B.Ed' });
  });
  it('returns nothing for a page it cannot read, instead of guessing', () => {
    expect(parseKeyPage('NATIONAL TESTING AGENCY\nSome other notice')).toBeNull();
    expect(parseKeyPage('Subject : 322 - Physics\n(no date on this page)')).toBeNull();
  });
});

describe('reading a whole answer-key file', () => {
  it('merges pages of the same paper, counts dropped questions and reports unread pages', () => {
    const pages = [
      UG('11-05-2026', 'First', '101 - English', '111111111111    2222222222222\n111111111112    Drop'),
      UG('11-05-2026', 'First', '101 - English', '111111111113    2222222222223                 111111111114    Drop'),
      UG('12-05-2026', 'Second', '322 - Physics', '111111111115    2222222222224'),
      'a page with no heading',
      '',
    ];
    const r = parseKeyText(pages);
    expect(r.unreadPages).toEqual([4]);
    expect(r.sessions).toEqual([
      { date: '2026-05-11', shift: 'Shift 1', subjectCode: '101', subjectName: 'English', keyPage: 1, keyPages: 2, dropped: 2 },
      { date: '2026-05-12', shift: 'Shift 2', subjectCode: '322', subjectName: 'Physics', keyPage: 3, keyPages: 1, dropped: 0 },
    ]);
  });
  it('does not count the legend line that explains "DROP" on every page', () => {
    expect(parseKeyText([PG('SCQP24 - Physics', 1, '30.03.2025')]).sessions[0]).toMatchObject({ subjectCode: 'SCQP24', dropped: 0 });
  });
});
