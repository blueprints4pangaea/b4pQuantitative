// Operations: the operations dashboard as it was. Past shipments and the
// Shipment KPIs include every chapter's shipments (master sheet plus the
// chapter Shipment History docs, merged in the backend). Inventory is HQ only.
import App from "../App";

export default function Operations({ onHeaderStats }) {
  return <App embedded onHeaderStats={onHeaderStats} />;
}
