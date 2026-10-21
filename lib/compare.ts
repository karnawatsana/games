export type AnswerRow = { userId: string; questionNumber: number; questionText: string; answerText: string; points: number; rarity: string | null };
export type QuestionGroup = { questionNumber: number; questionText: string; entries: (AnswerRow & { top: boolean; matchCount: number })[] };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Group by question; mark the highest-scoring answer(s) and how many players gave the same answer. */
export function byQuestion(rows: AnswerRow[]): QuestionGroup[] {
  const nums = [...new Set(rows.map((r) => r.questionNumber))].sort((a, b) => a - b);
  return nums.map((n) => {
    const rs = rows.filter((r) => r.questionNumber === n);
    const best = Math.max(...rs.map((r) => r.points));
    return {
      questionNumber: n,
      questionText: rs[0].questionText,
      entries: rs.map((r) => ({ ...r, top: r.points === best && rs.length > 1, matchCount: rs.filter((o) => norm(o.answerText) === norm(r.answerText)).length }))
        .sort((a, b) => b.points - a.points || a.userId.localeCompare(b.userId)),
    };
  });
}

export function byPlayer(rows: AnswerRow[]): { userId: string; total: number; answers: AnswerRow[] }[] {
  const ids = [...new Set(rows.map((r) => r.userId))];
  return ids.map((userId) => {
    const answers = rows.filter((r) => r.userId === userId).sort((a, b) => a.questionNumber - b.questionNumber);
    return { userId, total: answers.reduce((s, a) => s + a.points, 0), answers };
  }).sort((a, b) => b.total - a.total || a.userId.localeCompare(b.userId));
}
