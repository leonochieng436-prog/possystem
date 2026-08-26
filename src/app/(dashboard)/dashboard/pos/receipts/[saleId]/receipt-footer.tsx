import type { ReceiptData } from "@/lib/receipts/receipt-types";

export function ReceiptFooter({ receipt }: { receipt: ReceiptData }) {
  return <footer className="receipt-footer">{receipt.notes && <p className="receipt-note"><strong>Note:</strong> {receipt.notes}</p>}<p>{receipt.settings.footerMessage}</p><p>Powered by DUKAOS</p></footer>;
}
