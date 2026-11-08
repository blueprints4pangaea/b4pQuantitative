// score bands from the top of katelyn's sheet
export const BANDS = [
  { name: "Excellent", min: 91, color: "#0ca30c", tint: "rgba(12, 163, 12, 0.07)", icon: "●" },
  { name: "Sufficient", min: 66, color: "#7cc97c", tint: "rgba(124, 201, 124, 0.08)", icon: "◐" },
  { name: "Weak", min: 41, color: "#fab219", tint: "rgba(250, 178, 25, 0.09)", icon: "▲" },
  { name: "Offboard", min: 0, color: "#d03b3b", tint: "rgba(208, 59, 59, 0.07)", icon: "■" },
];

export const STAGES = ["Beginner", "Intermediate", "Advanced"];

// a drop this big gets flagged even if the band is fine
export const BIG_DROP = 10;

export function bandFor(score) {
  if (score == null) return null;
  return BANDS.find((b) => score >= b.min);
}

export function isActive(chapter, sem) {
  return sem in chapter.scores || chapter.unscored.includes(sem);
}

// stage as of a semester, or null if the sheet has no stage for it
export function stageAt(chapter, sem, stageSemesters) {
  return stageSemesters.includes(sem) ? chapter.stages[sem] ?? null : null;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function averageScore(chapters, sem) {
  return average(chapters.filter((ch) => sem in ch.scores).map((ch) => ch.scores[sem]));
}

export function summarize(data, sem) {
  const { semesters, stageSemesters, chapters } = data;
  const idx = semesters.indexOf(sem);
  const prev = idx > 0 ? semesters[idx - 1] : null;
  const earlier = semesters.slice(0, idx);

  // last semester before this one that has stages
  const prevStageSem = stageSemesters.filter((s) => semesters.indexOf(s) < idx).pop() ?? null;
  const hasStages = stageSemesters.includes(sem);

  const active = chapters.filter((ch) => isActive(ch, sem));

  //build one row per active chapter
  const rows = active.map((ch) => {
    const score = ch.scores[sem] ?? null;
    const prevScore = prev ? ch.scores[prev] ?? null : null;
    const delta = score != null && prevScore != null ? score - prevScore : null;
    const stage = stageAt(ch, sem, stageSemesters);
    const prevStage = prevStageSem ? ch.stages[prevStageSem] ?? null : null;

    let move = null;
    if (hasStages && stage && prevStage && isActive(ch, prevStageSem)) {
      const diff = STAGES.indexOf(stage) - STAGES.indexOf(prevStage);
      move = diff > 0 ? "up" : diff < 0 ? "down" : "same";
    }

    const band = bandFor(score);
    const isNew = !earlier.some((s) => isActive(ch, s));
    const needsAttention =
      score == null ||
      band.name === "Weak" ||
      band.name === "Offboard" ||
      move === "down" ||
      (delta != null && delta <= -BIG_DROP);

    return {
      name: ch.name,
      chapter: ch,
      score,
      prevScore,
      delta,
      deltaPct: delta != null && prevScore ? (delta / prevScore) * 100 : null,
      stage,
      prevStage,
      move,
      band,
      isNew,
      needsAttention,
    };
  });

  //worst first, then by score
  rows.sort((a, b) => {
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
    return (a.score ?? -1) - (b.score ?? -1);
  });

  const stageCounts = hasStages
    ? STAGES.map((stage) => {
        const inStage = rows.filter((r) => r.stage === stage);
        return { stage, count: inStage.length, share: active.length ? inStage.length / active.length : 0, rows: inStage };
      })
    : null;

  return {
    sem,
    prev,
    prevStageSem,
    hasStages,
    rows,
    activeCount: active.length,
    avg: averageScore(chapters, sem),
    prevAvg: prev ? averageScore(chapters, prev) : null,
    newChapters: rows.filter((r) => r.isNew && idx > 0),
    offboarded: prev ? chapters.filter((ch) => isActive(ch, prev) && !isActive(ch, sem)) : [],
    stageCounts,
    movedUp: rows.filter((r) => r.move === "up"),
    droppedBack: rows.filter((r) => r.move === "down"),
    attention: rows.filter((r) => r.needsAttention),
  };
}

// stage and "needs attention" filters on a summary's rows
export function filterRows(rows, { stage, attention }) {
  return rows.filter((r) => (!stage || r.stage === stage) && (!attention || r.needsAttention));
}

// average of just these rows, and their average change for chapters scored both semesters
export function rowAverages(rows) {
  return {
    now: average(rows.filter((r) => r.score != null).map((r) => r.score)),
    change: average(rows.filter((r) => r.delta != null).map((r) => r.delta)),
  };
}
