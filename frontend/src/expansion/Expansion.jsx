// Expansion, moved in from expansionDash: chapter scores. The chapter-doc
// shipments it used to show here are merged into Operations and Home instead.
import { useScores } from "../shared/data";
import { ErrorText, HeaderStatus, Loading } from "../shared/ui";
import ChapterScores from "./ChapterScores";

export default function Expansion() {
  const scores = useScores();

  return (
    <div className="combo-stack expansion-scope">
      {scores.data?.source === "snapshot" && (
        <HeaderStatus>
          <p className="combo-fineprint">Showing a saved copy of the scores sheet. Live data turns on once the sheet is connected.</p>
        </HeaderStatus>
      )}
      {scores.loading && <Loading what="chapter scores" />}
      {scores.error && <ErrorText>{scores.error}</ErrorText>}
      {scores.data && <ChapterScores data={scores.data} />}
    </div>
  );
}
