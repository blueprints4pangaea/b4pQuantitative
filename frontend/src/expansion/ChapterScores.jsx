import { useEffect, useMemo, useState } from "react";
import { BANDS, BIG_DROP, STAGES, bandFor, filterRows, rowAverages, summarize } from "./scoreStats";
import "./ChapterScores.css";

const MOVE_ARROW = { up: "↑", down: "↓" };

// line colors for picked chapters, a chapter keeps its color until it's unpicked
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a"];

function formatScore(value) {
  if (value == null) return "–";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDelta(delta, digits = 0) {
  if (delta == null) return "";
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
  return `${sign}${Math.abs(delta).toFixed(digits)}`;
}

function names(rows) {
  return rows.map((r) => r.name ?? r).join(", ");
}

// --- filters: one row, everything below follows them ---

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="filter">
      <span className="filter-label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value ?? "all"}
            type="button"
            className={o.value === value ? "active" : undefined}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.value)}
          >
            {o.label}
            {o.count != null && <small>{o.count}</small>}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterBar({ data, summary, sem, setSem, stage, setStage, attention, setAttention }) {
  const stageOptions = [
    { value: null, label: "All" },
    ...STAGES.map((s) => ({
      value: s,
      label: s,
      count: summary.hasStages ? summary.rows.filter((r) => r.stage === s).length : null,
      disabled: !summary.hasStages,
      title: summary.hasStages ? undefined : `The sheet has no stages for ${sem}`,
    })),
  ];

  return (
    <div className="filter-bar">
      <Segmented label="Semester" options={data.semesters.map((s) => ({ value: s, label: s }))} value={sem} onChange={setSem} />
      <Segmented label="Stage" options={stageOptions} value={summary.hasStages ? stage : null} onChange={setStage} />
      <Segmented
        label="Show"
        options={[
          { value: false, label: "All chapters" },
          { value: true, label: "Needs attention", count: summary.attention.length },
        ]}
        value={attention}
        onChange={setAttention}
      />
    </div>
  );
}

// --- where chapters stand: one row per chapter, last semester → this one ---

const BAND_ZONES = BANDS.map((band, i) => ({ ...band, max: i === 0 ? 100 : BANDS[i - 1].min }));

function Standings({ rows, prev, picked, onPick }) {
  if (!rows.length) return <p className="empty-note">No chapters match these filters.</p>;

  return (
    <div className="standings">
      <div className="standings-axis" aria-hidden="true">
        <span />
        <div className="track-axis">
          {/* band names start where each band starts */}
          {BAND_ZONES.map((b) => (
            <span key={b.name} style={{ left: `${b.min}%` }}>
              {b.name} {b.min > 0 && b.min}
            </span>
          ))}
        </div>
        <span />
      </div>

      <ul>
        {rows.map((r) => {
          const color = picked[r.name];
          const lo = Math.min(r.score ?? 0, r.prevScore ?? r.score ?? 0);
          const hi = Math.max(r.score ?? 0, r.prevScore ?? r.score ?? 0);
          return (
            <li key={r.name}>
              <button
                type="button"
                className={color ? "standing picked" : "standing"}
                style={color ? { "--pick": color } : undefined}
                aria-pressed={Boolean(color)}
                onClick={() => onPick(r.name)}
              >
                <span className="standing-name">
                  <strong>{r.name}</strong>
                  <span className="standing-meta">
                    {r.stage && (
                      <span className="stage-label">
                        {r.stage}
                        {r.move && r.move !== "same" && (
                          <span className={`move ${r.move}`} title={`Moved ${r.move} from ${r.prevStage}`}>
                            {MOVE_ARROW[r.move]}
                          </span>
                        )}
                      </span>
                    )}
                    {r.isNew && <span className="tag">New</span>}
                    {r.delta != null && r.delta <= -BIG_DROP && <span className="tag warn">Big drop</span>}
                  </span>
                </span>

                <span className="track" title={r.prevScore != null ? `${prev}: ${formatScore(r.prevScore)}` : undefined}>
                  {BAND_ZONES.map((b) => (
                    <i key={b.name} className="zone" style={{ left: `${b.min}%`, width: `${b.max - b.min}%`, background: b.tint }} />
                  ))}
                  {r.score != null && r.prevScore != null && (
                    <i className={r.delta < 0 ? "span down" : "span"} style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
                  )}
                  {r.prevScore != null && <i className="dot prev" style={{ left: `${r.prevScore}%` }} />}
                  {r.score != null && <i className="dot now" style={{ left: `${r.score}%`, "--band": bandFor(r.score).color }} />}
                </span>

                <span className="standing-score">
                  {r.score == null ? (
                    <span className="unscored">Not scored</span>
                  ) : (
                    <>
                      <strong>{formatScore(r.score)}</strong>
                      <span className={r.delta > 0 ? "up" : r.delta < 0 ? "down" : "flat"}>
                        {r.delta == null ? (r.isNew ? "new" : "–") : formatDelta(r.delta)}
                      </span>
                    </>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="legend">
        <span>
          <i className="key-dot prev" /> {prev ?? "Last semester"}
        </span>
        <span>
          <i className="key-dot now" /> This semester, colored by band
        </span>
      </div>
    </div>
  );
}

// --- scores over time: the average plus up to 3 picked chapters ---

const W = 560;
const H = 300;
const PAD = { top: 16, right: 96, bottom: 32, left: 34 };
const Y_TICKS = [0, 25, 50, 75, 100];

function TrendChart({ data, chapters, lines, avgLabel }) {
  const [hoverSem, setHoverSem] = useState(null);
  const { semesters } = data;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const step = semesters.length > 1 ? plotW / (semesters.length - 1) : 0;
  const x = (i) => PAD.left + (semesters.length > 1 ? i * step : plotW / 2);
  const y = (score) => PAD.top + plotH * (1 - score / 100);

  //path with gaps where a chapter wasn't scored
  const pathFor = (scores) => {
    let d = "";
    let drawing = false;
    semesters.forEach((sem, i) => {
      const v = scores[sem];
      if (v == null) {
        drawing = false;
        return;
      }
      d += `${drawing ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      drawing = true;
    });
    return d;
  };

  //average of whichever chapters the filters left
  const avgScores = Object.fromEntries(
    semesters.map((s) => {
      const vals = chapters.filter((ch) => s in ch.scores).map((ch) => ch.scores[s]);
      return [s, vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null];
    })
  );

  const series = [
    { name: avgLabel, scores: avgScores, color: "var(--bp-navy)", avg: true },
    ...lines.map((l) => ({ ...l, scores: data.chapters.find((ch) => ch.name === l.name).scores })),
  ];

  //end labels at each line's last point, nudged apart so they don't overlap
  const labels = series
    .map((s) => {
      const lastIdx = semesters.findLastIndex((sem) => s.scores[sem] != null);
      return lastIdx < 0 ? null : { ...s, ly: y(s.scores[semesters[lastIdx]]), lx: x(lastIdx) };
    })
    .filter(Boolean)
    .sort((a, b) => a.ly - b.ly);
  labels.forEach((l, i) => {
    if (i > 0 && l.ly - labels[i - 1].ly < 15) l.ly = labels[i - 1].ly + 15;
  });

  const hoverIdx = semesters.indexOf(hoverSem);

  //snap the crosshair to the closest semester
  const snapToSemester = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = step ? Math.round((px - PAD.left) / step) : 0;
    setHoverSem(semesters[Math.min(Math.max(i, 0), semesters.length - 1)]);
  };

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Scores by semester: ${names(series)}`}
        onMouseMove={snapToSemester}
        onMouseLeave={() => setHoverSem(null)}
      >
        {BAND_ZONES.map((b) => (
          <rect key={b.name} x={PAD.left} y={y(b.max)} width={plotW} height={y(b.min) - y(b.max)} fill={b.tint} />
        ))}

        {Y_TICKS.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} />
            <text className="tick" x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
              {t}
            </text>
          </g>
        ))}

        {semesters.map((sem, i) => (
          <text key={sem} className={i === hoverIdx ? "tick x active" : "tick x"} x={x(i)} y={H - 8} textAnchor="middle">
            {sem}
          </text>
        ))}

        {hoverIdx >= 0 && <line className="crosshair" x1={x(hoverIdx)} x2={x(hoverIdx)} y1={PAD.top} y2={PAD.top + plotH} />}

        {series.map((s) => (
          <g key={s.name} style={{ "--series": s.color }}>
            <path d={pathFor(s.scores)} className={s.avg ? "trend-path avg" : "trend-path"} />
            {!s.avg &&
              semesters.map((sem, i) =>
                s.scores[sem] == null ? null : <circle key={sem} className="trend-dot" cx={x(i)} cy={y(s.scores[sem])} r="4" />
              )}
          </g>
        ))}

        {labels.map((l) => (
          <text key={l.name} className="end-label" x={l.lx + 10} y={l.ly + 4}>
            {l.name}
          </text>
        ))}
      </svg>

      {hoverIdx >= 0 && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(x(hoverIdx) / W) * 100}%`,
            transform: hoverIdx === semesters.length - 1 ? "translateX(-100%)" : hoverIdx === 0 ? "none" : "translateX(-50%)",
          }}
        >
          <strong>{hoverSem}</strong>
          {series.map((s) => (
            <span key={s.name}>
              <i className={s.avg ? "swatch avg" : "swatch"} style={{ borderColor: s.color }} />
              <b>{s.scores[hoverSem] == null ? "–" : formatScore(Math.round(s.scores[hoverSem] * 10) / 10)}</b> {s.name}
            </span>
          ))}
        </div>
      )}

      <div className="legend">
        {series.map((s) => (
          <span key={s.name}>
            <i className={s.avg ? "swatch avg" : "swatch"} style={{ borderColor: s.color }} /> {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// --- every score, for anyone who wants the numbers ---

function ScoreTable({ data, rows, sem }) {
  return (
    <details className="all-scores">
      <summary>All scores by semester ({rows.length} chapters)</summary>
      <div className="table-wrap">
        <table className="health-table">
          <thead>
            <tr>
              <th>Chapter</th>
              <th>Stage</th>
              {data.semesters.map((s) => (
                <th key={s} className={s === sem ? "num current" : "num"}>
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((r) => (
                <tr key={r.name}>
                  <td className="chapter-cell">{r.name}</td>
                  <td>{r.stage ?? "–"}</td>
                  {data.semesters.map((s) => (
                    <td key={s} className={s === sem ? "num current" : "num"}>
                      {r.chapter.unscored.includes(s) ? "missing" : formatScore(r.chapter.scores[s])}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default function ChapterScores({ data }) {
  //?sem=F25&stage=Beginner&attention=1&chapters=NYU,MSU opens straight to that view
  const params = new URLSearchParams(window.location.search);
  const [sem, setSem] = useState(data.semesters.includes(params.get("sem")) ? params.get("sem") : data.semesters.at(-1));
  const [stage, setStage] = useState(STAGES.includes(params.get("stage")) ? params.get("stage") : null);
  const [attention, setAttention] = useState(params.get("attention") === "1");
  const [picks, setPicks] = useState(() => {
    const wanted = (params.get("chapters") ?? params.get("chapter") ?? "").split(",");
    return wanted.filter((n) => data.chapters.some((ch) => ch.name === n)).slice(0, SERIES.length).map((name, slot) => ({ name, slot }));
  });

  const summary = useMemo(() => summarize(data, sem), [data, sem]);
  const rows = filterRows(summary.rows, { stage: summary.hasStages ? stage : null, attention });
  const filtered = rows.length !== summary.rows.length;

  //keep the url in sync so a view can be shared
  useEffect(() => {
    const next = new URLSearchParams();
    next.set("sem", sem);
    if (stage) next.set("stage", stage);
    if (attention) next.set("attention", "1");
    if (picks.length) next.set("chapters", picks.map((p) => p.name).join(","));
    window.history.replaceState(null, "", `?${next}`);
  }, [sem, stage, attention, picks]);

  //click a chapter to add it to the chart, again to take it off
  const togglePick = (name) =>
    setPicks((cur) => {
      if (cur.some((p) => p.name === name)) return cur.filter((p) => p.name !== name);
      const free = SERIES.findIndex((_, slot) => !cur.some((p) => p.slot === slot));
      return free < 0 ? cur : [...cur, { name, slot: free }];
    });

  //with nothing picked, a small filtered group is drawn on its own
  const lines = picks.length
    ? picks.map((p) => ({ name: p.name, color: SERIES[p.slot] }))
    : rows.length <= SERIES.length && filtered
      ? rows.map((r, i) => ({ name: r.name, color: SERIES[i] }))
      : [];
  const picked = Object.fromEntries(lines.map((l) => [l.name, l.color]));

  const avg = filtered ? rowAverages(rows) : { now: summary.avg, change: summary.avg != null && summary.prevAvg != null ? summary.avg - summary.prevAvg : null };
  const groupLabel = [attention && "needing attention", stage && summary.hasStages && stage].filter(Boolean).join(" · ");
  const movedUp = rows.filter((r) => r.move === "up");
  const droppedBack = rows.filter((r) => r.move === "down");
  const newOnes = rows.filter((r) => r.isNew && data.semesters.indexOf(sem) > 0);

  return (
    <section className="chapter-scores">
      <FilterBar
        data={data}
        summary={summary}
        sem={sem}
        setSem={setSem}
        stage={stage}
        setStage={setStage}
        attention={attention}
        setAttention={setAttention}
      />

      <div className="scores-top">
        <div className="hero">
          <span className="eyebrow">
            Average score · {sem}
            {groupLabel && ` · ${groupLabel}`}
          </span>
          <div className="hero-row">
            <strong className="hero-value">{formatScore(avg.now && Math.round(avg.now * 10) / 10)}</strong>
            {avg.change != null && (
              <span className={avg.change >= 0 ? "delta-pill up" : "delta-pill down"}>
                <b>
                  {avg.change >= 0 ? "▲" : "▼"} {Math.abs(avg.change).toFixed(1)} pts
                </b>
                <small>{filtered ? `avg change since ${summary.prev}` : `vs ${summary.prev}`}</small>
              </span>
            )}
          </div>
        </div>

        <div className="stat-tiles">
          <div className="stat-tile">
            <span className="eyebrow">Chapters</span>
            <strong>{rows.length}</strong>
            <small>
              {[newOnes.length > 0 && `+${newOnes.length} new`, !filtered && summary.offboarded.length > 0 && `${summary.offboarded.length} left`]
                .filter(Boolean)
                .join(" · ")}
            </small>
          </div>
          <div className="stat-tile" title={[names(movedUp), names(droppedBack)].filter(Boolean).join(" / ")}>
            <span className="eyebrow">Stage changes</span>
            <strong>
              {summary.hasStages && summary.prevStageSem ? (
                <>
                  <span className="up">↑{movedUp.length}</span> <span className="down">↓{droppedBack.length}</span>
                </>
              ) : (
                "–"
              )}
            </strong>
            <small>{[names(movedUp), names(droppedBack)].filter(Boolean).join(" / ")}</small>
          </div>
          <div className="stat-tile">
            <span className="eyebrow">Need attention</span>
            <strong>{rows.filter((r) => r.needsAttention).length}</strong>
            <small>Weak, stage drop, or −{BIG_DROP}+ pts</small>
          </div>
        </div>
      </div>

      <div className="scores-grid">
        <div className="card">
          <div className="card-head">
            <h3>Where chapters stand · {sem}</h3>
            <p>Lowest first. Click a chapter to add it to the chart.</p>
          </div>
          <Standings rows={rows} prev={summary.prev} picked={picked} onPick={togglePick} />
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Scores over time</h3>
            <p>
              {lines.length
                ? "Click a chapter again to take it off."
                : `Pick up to ${SERIES.length} chapters on the left to compare them.`}
            </p>
          </div>
          <TrendChart
            data={data}
            chapters={filtered ? rows.map((r) => r.chapter) : data.chapters}
            lines={lines}
            avgLabel={filtered ? "Group average" : "Network average"}
          />
          {picks.length > 0 && (
            <button type="button" className="link-button" onClick={() => setPicks([])}>
              Clear picked chapters
            </button>
          )}
        </div>
      </div>

      <ScoreTable data={data} rows={rows} sem={sem} />

      {!filtered && summary.offboarded.length > 0 && (
        <p className="footnote">No longer active in {sem}: {names(summary.offboarded.map((ch) => ch.name))}.</p>
      )}
    </section>
  );
}
