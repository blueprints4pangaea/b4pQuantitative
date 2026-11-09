// One chapter list for every tab. Sheets spell chapters differently
// ("UMich", "Umich", "Michigan"), so every name goes through canonicalChapter()
// before it's shown or filtered on. Add a spelling to `aliases` when a sheet uses
// a new one. Unknown names are kept as they are, trimmed.
// HQ and the UMich chapter are the same group, so every UMich spelling counts as HQ.
export const HQ = "HQ";

export const CHAPTERS = [
  { id: "hq", name: HQ, aliases: ["hq", "umich", "michigan", "university of michigan", "u of m"] },
  { id: "msu", name: "MSU", aliases: ["msu", "michigan state", "michigan state university"] },
  { id: "wsu", name: "WSU", aliases: ["wsu", "wayne", "wayne state", "wayne state university"] },
  { id: "marquette", name: "Marquette", aliases: ["marquette", "marquette university"] },
  { id: "gha", name: "GHA", aliases: ["gha"] },
  { id: "usc", name: "USC", aliases: ["usc"] },
  { id: "utsa", name: "UT San Antonio", aliases: ["ut-san", "ut san", "utsa", "ut san antonio"] },
  { id: "cornell", name: "Cornell", aliases: ["cornell"] },
  { id: "gnj", name: "GNJ", aliases: ["gnj"] },
  { id: "nyu", name: "NYU", aliases: ["nyu"] },
  { id: "scu", name: "SCU", aliases: ["scu", "santa clara"] },
  { id: "berkeley", name: "UC Berkeley", aliases: ["uc berkeley", "berkeley", "ucb"] },
  { id: "uno", name: "UNO", aliases: ["uno"] },
  { id: "washu", name: "WashU", aliases: ["washu", "wustl", "washington university"] },
];

const BY_ALIAS = new Map();
for (const ch of CHAPTERS) {
  BY_ALIAS.set(ch.name.toLowerCase(), ch.name);
  for (const a of ch.aliases) BY_ALIAS.set(a, ch.name);
}

const squash = (s) => String(s ?? "").trim().replace(/\s+/g, " ");

/** "Umich " -> "UMich". Blank -> "". */
export function canonicalChapter(raw) {
  const s = squash(raw);
  if (!s) return "";
  return BY_ALIAS.get(s.toLowerCase()) ?? s;
}

/** "UMich, WSU" -> ["UMich", "WSU"] */
export function splitChapters(raw) {
  return [...new Set(String(raw ?? "").split(/[,/&]/).map(canonicalChapter).filter(Boolean))];
}

/** Every chapter name to offer in the filter (HQ has its own option): the known list plus anything seen in data. */
export function chapterOptions(...lists) {
  const names = new Set(CHAPTERS.map((c) => c.name).filter((n) => n !== HQ));
  for (const list of lists) for (const n of list ?? []) if (n && n !== HQ) names.add(n);
  return [...names].sort((a, b) => a.localeCompare(b));
}
