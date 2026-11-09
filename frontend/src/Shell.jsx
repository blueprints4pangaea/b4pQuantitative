// The combined dashboard: Home, Operations, Finance and Expansion under one
// header. The chapter and semester filters are shared by Home, chapter
// operations and Finance, and stay set when you switch tabs.
import { useEffect, useMemo, useState } from "react";
import Expansion from "./expansion/Expansion";
import Finance from "./finance/Finance";
import Home from "./home/Home";
import Operations from "./operations/Operations";
import { HQ, chapterOptions } from "./shared/chapters";
import { useFinance, useScores, useShipments } from "./shared/data";
import { semesterName, sortSemesters } from "./shared/semester";

const TABS = [
  { id: "home", label: "Home" },
  { id: "operations", label: "Operations" },
  { id: "finance", label: "Finance" },
  { id: "expansion", label: "Expansion" },
];

// #finance, #operations/hq ... so a tab can be linked to and survives a refresh
function readHash() {
  const [tab, sub] = window.location.hash.replace(/^#\/?/, "").split("/");
  return { tab: TABS.some((t) => t.id === tab) ? tab : "home", sub: sub || "chapters" };
}

function FilterBar({ filters, setFilters, chapters, semesters, allowHq }) {
  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });
  return (
    <section className="combo-filters" aria-label="Filters">
      <label>
        <span className="title-block-label">Chapter</span>
        <select className="shipment-filter-select" value={filters.chapter} onChange={set("chapter")}>
          <option value="all">All of B4P</option>
          <option value="chapters">All chapters</option>
          {allowHq && <option value={HQ}>HQ (UMich)</option>}
          <optgroup label="One chapter">
            {chapters.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <label>
        <span className="title-block-label">Semester</span>
        <select className="shipment-filter-select" value={filters.semester} onChange={set("semester")}>
          <option value="all">All semesters</option>
          {semesters.map((s) => (
            <option key={s} value={s}>
              {semesterName(s)} ({s})
            </option>
          ))}
        </select>
      </label>
      {(filters.chapter !== "all" || filters.semester !== "all") && (
        <button type="button" className="secondary-button" onClick={() => setFilters({ chapter: "all", semester: "all" })}>
          Clear filters
        </button>
      )}
    </section>
  );
}

export default function Shell() {
  const [route, setRoute] = useState(readHash);
  const [filters, setFilters] = useState({ chapter: "all", semester: "all" });
  // Units on hand and Sheet pulled, reported by the operations page for the header
  const [opsStats, setOpsStats] = useState(null);
  const ships = useShipments();
  const fin = useFinance();
  // Active chapters and Sheet pulled for the Expansion header, as expansionDash showed them
  const scores = useScores();
  const latestSemester = scores.data?.semesters.at(-1);
  const activeNow = scores.data?.chapters.filter((ch) => latestSemester in ch.scores || ch.unscored.includes(latestSemester)).length;

  useEffect(() => {
    const onHash = () => setRoute(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const goTo = (tab, sub) => {
    window.location.hash = sub ? `${tab}/${sub}` : tab;
    window.scrollTo({ top: 0 });
  };

  const chapters = useMemo(
    () => chapterOptions(ships.rows.flatMap((s) => s.chapters), fin.rows.map((t) => t.entity)),
    [ships.rows, fin.rows]
  );
  const semesters = useMemo(
    () => sortSemesters([...ships.rows.map((s) => s.semester), ...fin.rows.map((t) => t.semester)]),
    [ships.rows, fin.rows]
  );

  // the shared filters apply to Home and Finance; Operations and Expansion keep their own
  const showFilters = route.tab === "home" || route.tab === "finance";

  return (
    <main className="page-shell">
      <header className="top-bar">
        <div className="title-block">
          <div className="title-block-cell">
            <h1>
              <em>Blueprints for Pangaea</em>
              {route.tab === "home" ? "Dashboard" : `${TABS.find((t) => t.id === route.tab).label} Dashboard`}
            </h1>
          </div>
          {showFilters && (
            <>
            <div className="title-block-cell">
              <p className="title-block-label">Showing</p>
              <p className="title-block-value">
                {showFilters
                  ? filters.chapter === "all"
                    ? "All of B4P"
                    : filters.chapter === "chapters"
                      ? "All chapters"
                      : filters.chapter === HQ
                        ? "HQ (UMich)"
                        : filters.chapter
                  : ""}
              </p>
            </div>
            <div className="title-block-cell">
              <p className="title-block-label">Semester</p>
              <p className="title-block-value">{showFilters && filters.semester !== "all" ? filters.semester : "All"}</p>
            </div>
            </>
          )}
          {route.tab === "expansion" && (
            <>
              <div className="title-block-cell">
                <p className="title-block-label">Active chapters</p>
                <p className="title-block-value">{scores.data ? activeNow : "—"}</p>
              </div>
              <div className="title-block-cell">
                <p className="title-block-label">Sheet pulled</p>
                <p className="title-block-value">
                  {scores.data
                    ? scores.data.source === "snapshot"
                      ? "Saved copy"
                      : new Date(scores.data.pulledAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </p>
              </div>
            </>
          )}
          {route.tab === "operations" && (
            <>
              <div className="title-block-cell">
                <p className="title-block-label">Units on hand</p>
                <p className="title-block-value">{opsStats?.unitsOnHand ?? "—"}</p>
              </div>
              <div className="title-block-cell">
                <p className="title-block-label">Sheet pulled</p>
                <p className="title-block-value">{opsStats?.sheetPulled ?? "—"}</p>
              </div>
            </>
          )}
        </div>
        <div className="title-block-logo">
          <img className="dashboard-logo" src="/blueprints-logo.png" alt="Blueprints for Pangaea" />
        </div>
      </header>

      <section className="tabs-section combo-main-tabs">
        <div className="tabs" role="tablist" aria-label="Dashboard areas">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === route.tab}
              className={t.id === route.tab ? "tab-button active" : "tab-button"}
              onClick={() => goTo(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {showFilters && (
          <FilterBar filters={filters} setFilters={setFilters} chapters={chapters} semesters={semesters} allowHq />
        )}
      </section>

      <div className="combo-body">
        {route.tab === "home" && <Home filters={filters} goTo={goTo} />}
        {route.tab === "operations" && <Operations onHeaderStats={setOpsStats} />}
        {route.tab === "finance" && <Finance filters={filters} setFilters={setFilters} />}
        {route.tab === "expansion" && <Expansion />}
      </div>
    </main>
  );
}
