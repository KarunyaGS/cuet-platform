/** Question stem with its structure: maths, List-I / List-II for match-the-following, and the question's diagram. */
import { Rich } from './rich';

interface Structure {
  left?: string[];
  right?: string[];
  mediaAssetId?: string;
}
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export function QuestionStem({ stem, structure, compact = false }: { stem: string; structure: unknown; compact?: boolean }) {
  const s = (structure && typeof structure === 'object' ? structure : {}) as Structure;
  return (
    <div className={compact ? 'text-sm' : 'text-[15px]'}>
      <Rich text={stem} />
      {s.left && s.right && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-paper text-left">
                <th className="border border-rule px-2 py-1 font-semibold">List-I</th>
                <th className="border border-rule px-2 py-1 font-semibold">List-II</th>
              </tr>
            </thead>
            <tbody>
              {s.left.map((l, i) => (
                <tr key={i} className="align-top">
                  <td className="border border-rule px-2 py-1"><span className="mr-1 font-semibold">{String.fromCharCode(65 + i)}.</span><Rich text={l} inline /></td>
                  <td className="border border-rule px-2 py-1">{s.right![i] !== undefined && <><span className="mr-1 font-semibold">{ROMAN[i]}.</span><Rich text={s.right![i]!} inline /></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {s.mediaAssetId && (
        <img src={`/api/learn/media/${s.mediaAssetId}`} alt="Diagram for this question" className="mx-auto mt-2 max-h-72 w-auto rounded border border-rule bg-surface p-1" loading="lazy" />
      )}
    </div>
  );
}
