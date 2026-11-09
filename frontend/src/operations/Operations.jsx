// Operations: chapter operations (filterable by chapter) plus the original
// HQ inventory and shipment tabs, which stay HQ-only and unfiltered.
import App from "../App";
import { Subtabs } from "../shared/ui";
import ChapterOps from "./ChapterOps";

export default function Operations({ filters, sub, setSub }) {
  return (
    <div className="combo-stack">
      <Subtabs
        tabs={[
          { id: "chapters", label: "Chapter operations" },
          { id: "hq", label: "HQ inventory & shipments" },
        ]}
        value={sub}
        onChange={setSub}
      />
      {sub === "chapters" ? <ChapterOps filters={filters} /> : <App embedded />}
    </div>
  );
}
