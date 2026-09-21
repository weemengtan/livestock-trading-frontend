import { strFromU8, unzipSync } from "fflate";

/**
 * Client-side pre-check of an .xlsx before upload: is the required tab there,
 * and is it visible? It reads only the workbook manifest (`xl/workbook.xml`,
 * the list of tab names and their hidden state) — never any cell data — so
 * the user gets an instant, readable answer instead of waiting on an upload.
 *
 * Advisory only: the backend (`domain/ingestion/workbook.py`) is
 * authoritative and repeats the same checks. If the file cannot be inspected
 * here for any reason, this returns ok and lets the backend decide — it only
 * ever blocks on a definite "tab missing" or "tab hidden".
 */

type SheetTab = { name: string; hidden: boolean };

export type PrecheckResult = { ok: true } | { ok: false; code: "REQUIRED_SHEET_MISSING" | "REQUIRED_SHEET_HIDDEN"; message: string };

// Mirrors the backend's header/sheet-name normalisation (`normalise` in
// domain/ingestion/headers.py): case, punctuation and spacing are ignored.
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function readSheetTabs(file: File): Promise<SheetTab[] | null> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entries = unzipSync(bytes, { filter: (entry) => entry.name === "xl/workbook.xml" });
    const manifest = entries["xl/workbook.xml"];
    if (!manifest) return null;
    const xml = new DOMParser().parseFromString(strFromU8(manifest), "application/xml");
    return Array.from(xml.getElementsByTagName("sheet")).map((sheet) => ({
      name: sheet.getAttribute("name") ?? "",
      hidden: (sheet.getAttribute("state") ?? "visible") !== "visible",
    }));
  } catch {
    return null;
  }
}

export async function precheckWorkbook(file: File, requiredSheetName: string): Promise<PrecheckResult> {
  const tabs = await readSheetTabs(file);
  if (!tabs) return { ok: true };

  const target = normalise(requiredSheetName);
  const match = tabs.find((tab) => normalise(tab.name) === target);

  if (!match) {
    const visibleTabs = tabs.filter((tab) => !tab.hidden).map((tab) => tab.name);
    return {
      ok: false,
      code: "REQUIRED_SHEET_MISSING",
      message:
        `This file has no '${requiredSheetName}' tab. Tabs found: ${visibleTabs.length ? visibleTabs.join(", ") : "none"}. ` +
        "Please upload the daily Active Purchase Orders file that includes it.",
    };
  }
  if (match.hidden) {
    return {
      ok: false,
      code: "REQUIRED_SHEET_HIDDEN",
      message: `The '${match.name}' tab is hidden in this file. Please unhide it in Excel and upload the file again.`,
    };
  }
  return { ok: true };
}
