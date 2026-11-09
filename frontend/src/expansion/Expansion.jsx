// Expansion, moved in from expansionDash: chapter scores and the chapter-doc
// shipments page. Both pages keep their own filters.
import { useState } from "react";
import { useScores } from "../shared/data";
import { ErrorText, Loading, Subtabs } from "../shared/ui";
import ChapterScores from "./ChapterScores";
import Shipments from "./Shipments";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export default function Expansion() {
  const [tab, setTab] = useState("scores");
  const scores = useScores();

  return (
    <div className="combo-stack expansion-scope">
      {tab === "scores" && scores.data?.source === "snapshot" && (
        <p className="combo-fineprint">Showing a saved copy of the scores sheet. Live data turns on once the sheet is connected.</p>
      )}
      <Subtabs
        tabs={[
          { id: "scores", label: "Chapter Scores" },
          { id: "shipments", label: "Chapter Shipments" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "scores" && (
        <>
          {scores.loading && <Loading what="chapter scores" />}
          {scores.error && <ErrorText>{scores.error}</ErrorText>}
          {scores.data && <ChapterScores data={scores.data} />}
        </>
      )}
      {tab === "shipments" && <Shipments apiBase={API_BASE} />}
    </div>
  );
}
