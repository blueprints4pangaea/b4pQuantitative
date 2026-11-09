// Loads each area's data once and puts it in one shape: every row gets
// canonical chapter names and a semester, so the shared filters work everywhere.
import { useMemo } from "react";
import { useApi } from "./api";
import { HQ, canonicalChapter, splitChapters } from "./chapters";
import { semesterOf, semesterOfDate } from "./semester";

/** Master shipment sheet rows, the source of truth for shipments and shipping cost. */
export function useShipments() {
  const res = useApi("/history/shipments");
  const rows = useMemo(
    () =>
      (res.data ?? []).map((s) => ({
        ...s,
        chapters: splitChapters(s.chapter),
        semester: semesterOf(s.year, s.month),
      })),
    [res.data]
  );
  return { ...res, rows };
}

/** Finance transactions. `entity` is "HQ" or a canonical chapter name. */
export function useFinance() {
  const res = useApi("/finance");
  const rows = useMemo(
    () =>
      (res.data?.transactions ?? []).map((t) => ({
        ...t,
        entity: t.entity === HQ ? HQ : canonicalChapter(t.entity),
        semester: semesterOfDate(t.date),
      })),
    [res.data]
  );
  return { ...res, rows, origins: res.data?.origins ?? {} };
}

export function useScores() {
  return useApi("/chapter-scores");
}


// --- shared filters: { chapter: "all" | "HQ" | "chapters" | <name>, semester: "all" | "F26" } ---

export const matchSemester = (row, filters) => filters.semester === "all" || row.semester === filters.semester;

/** For rows that belong to one entity (finance): HQ or a chapter. */
export function matchEntity(entity, filters) {
  if (filters.chapter === "all") return true;
  if (filters.chapter === "chapters") return entity !== HQ;
  return entity === filters.chapter;
}

/** For rows that list chapters (shipments). UMich shipments count as HQ. */
export function matchChapters(chapters, filters) {
  if (filters.chapter === "all") return true;
  if (filters.chapter === "chapters") return chapters.some((c) => c !== HQ);
  return chapters.includes(filters.chapter);
}

export function describeFilters(filters) {
  const who =
    filters.chapter === "all" ? "All of B4P" : filters.chapter === "chapters" ? "All chapters" : filters.chapter === HQ ? "HQ (UMich)" : filters.chapter;
  return filters.semester === "all" ? who : `${who} · ${filters.semester}`;
}

export function filterShipments(rows, filters) {
  return rows.filter((s) => matchChapters(s.chapters, filters) && matchSemester(s, filters));
}
