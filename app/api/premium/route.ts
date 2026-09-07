// POST /api/premium — x402-geschützter Endpoint (Phase 4 des Build-Plans).
//
// Nimmt eine bereits vom kostenlosen Chat-/Doc-Arm erzeugte Auswertung
// entgegen und liefert sie als herunterladbares PDF mit vollständigen
// Referenzen zurück. Bewusst kein beworbenes Feature — siehe lib/x402.ts.
//
// Bezahlung läuft über den x402-Facilitator (0,10 USDC, Celo Mainnet,
// payTo = BASTET-Agent-Wallet); die Route selbst führt keine Kette von
// Interview-Logik erneut aus, sondern formatiert nur, was der Client
// (Web/Doc-Arm) bereits vom kostenlosen Endpoint erhalten hat.

import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getX402Server, CELO_MAINNET_NETWORK, AGENT_WALLET_ADDRESS } from "@/lib/x402";

export const runtime = "nodejs";
export const maxDuration = 30;

interface PremiumRequestBody {
  title?: string;
  body: string;
  references?: string[];
}

const PAGE_WIDTH = 595.28; // A4, pt
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const FONT_SIZE = 11;
const LINE_HEIGHT = 15;

async function handler(request: NextRequest): Promise<NextResponse> {
  let payload: PremiumRequestBody;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  if (typeof payload.body !== "string" || !payload.body.trim()) {
    return NextResponse.json({ error: "body (die Auswertung) fehlt." }, { status: 400 });
  }

  const pdfBytes = await buildPdf(
    payload.title?.trim() || "BASTET — Zusammenfassung mit Referenzen",
    payload.body,
    payload.references ?? []
  );

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="bastet-zusammenfassung.pdf"',
    },
  });
}

export const POST = withX402(
  handler,
  {
    accepts: {
      scheme: "exact",
      price: "$0.10",
      network: CELO_MAINNET_NETWORK,
      payTo: AGENT_WALLET_ADDRESS,
    },
    description: "BASTET Premium: PDF-Zusammenfassung der Auswertung mit vollständigen Referenzen",
  },
  getX402Server()
);

async function buildPdf(title: string, body: string, references: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const writer = new PageWriter(doc, font, bold);
  writer.writeTitle(title);
  writer.writeParagraphs(body);

  if (references.length > 0) {
    writer.writeHeading("Referenzen");
    for (const ref of references) {
      writer.writeParagraphs(`• ${ref}`);
    }
  }

  return doc.save();
}

/** Einfacher Zeilenumbruch- und Seitenumbruch-Helfer, da pdf-lib das nicht eingebaut hat. */
class PageWriter {
  private page: PDFPage;
  private y: number;

  constructor(
    private doc: PDFDocument,
    private font: PDFFont,
    private bold: PDFFont
  ) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensureSpace(needed: number) {
    if (this.y - needed < MARGIN) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  private wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [""];
  }

  writeTitle(text: string) {
    this.ensureSpace(24);
    this.page.drawText(text, { x: MARGIN, y: this.y, size: 16, font: this.bold, color: rgb(0.12, 0.24, 0.18) });
    this.y -= 28;
  }

  writeHeading(text: string) {
    this.ensureSpace(20);
    this.page.drawText(text, { x: MARGIN, y: this.y, size: 13, font: this.bold, color: rgb(0.12, 0.24, 0.18) });
    this.y -= 20;
  }

  writeParagraphs(text: string) {
    const maxWidth = PAGE_WIDTH - MARGIN * 2;
    const paragraphs = text.split(/\n+/);
    for (const paragraph of paragraphs) {
      const lines = this.wrapLine(paragraph, this.font, FONT_SIZE, maxWidth);
      for (const line of lines) {
        this.ensureSpace(LINE_HEIGHT);
        this.page.drawText(line, { x: MARGIN, y: this.y, size: FONT_SIZE, font: this.font, color: rgb(0, 0, 0) });
        this.y -= LINE_HEIGHT;
      }
      this.y -= LINE_HEIGHT * 0.4;
    }
  }
}
