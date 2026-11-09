// Semester from a date: Winter = Jan-Apr, Spring/Summer = May-Aug, Fall = Sep-Dec.
// Labels match the chapter scores sheet: "W26", "S26", "F26".
const TERMS = ["W", "S", "F"];
const NAMES = { W: "Winter", S: "Spring/Summer", F: "Fall" };

export function semesterOf(year, month) {
  if (!year || !month) return null;
  const term = TERMS[Math.floor((month - 1) / 4)];
  return `${term}${String(year).slice(-2)}`;
}

/** "2026-03-15" -> "W26" */
export function semesterOfDate(iso) {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})/);
  return m ? semesterOf(Number(m[1]), Number(m[2])) : null;
}

/** Sort key so W25 < S25 < F25 < W26 */
export function semesterKey(label) {
  const m = String(label).match(/^([WSF])(\d{2})$/);
  return m ? Number(m[2]) * 3 + TERMS.indexOf(m[1]) : -1;
}

/** "F26" -> "Fall 2026" */
export function semesterName(label) {
  const m = String(label).match(/^([WSF])(\d{2})$/);
  return m ? `${NAMES[m[1]]} 20${m[2]}` : label;
}

/** Unique semesters, newest first. */
export function sortSemesters(labels) {
  return [...new Set(labels.filter(Boolean))].sort((a, b) => semesterKey(b) - semesterKey(a));
}

/** The semester today falls in. */
export function currentSemester(today = new Date()) {
  return semesterOf(today.getFullYear(), today.getMonth() + 1);
}
