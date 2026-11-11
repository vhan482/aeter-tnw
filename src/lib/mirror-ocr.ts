export type OcrCandidate = {
  sourceLine: string;
  detectedName: string;
  rank: number | null;
  damageRaw: string;
  warnings: string[];
};

export type RosterIdentity = {
  id: string;
  characterName: string;
  memberStatus?: string;
  aliases?: string[];
};

const groupedOrPlain = '(?:\\d{1,3}(?:,\\d{3})+|\\d{1,15})';
const damageAtEnd = new RegExp(
  '(?:^|\\s)(' + groupedOrPlain + '(?:\\.\\d{1,3})?\\s*[KMBT])\\s*$', 'i'
);
const integerAtEnd = new RegExp(
  '(?:^|\\s)(' + groupedOrPlain + ')\\s*$'
);

export function parseMirrorLeaderboardText(text: string): OcrCandidate[] {
  const lines = text.slice(0, 20000).split(/\r?\n/).slice(0, 250);
  const candidates: OcrCandidate[] = [];

  for (const line of lines) {
    const sourceLine = line.normalize('NFKC').replace(/[\t\u00a0]+/g, ' ').trim();
    if (!sourceLine || sourceLine.length > 240) continue;
    const damageMatch = damageAtEnd.exec(sourceLine) ?? integerAtEnd.exec(sourceLine);
    if (!damageMatch || damageMatch.index === 0) continue;
    const damageRaw = damageMatch[1].replace(/\s+/g, '');
    const prefix = sourceLine.slice(0, damageMatch.index).trim();
    if (!prefix || /^rank(?:ing)?\b/i.test(prefix)) continue;
    const rankMatch = /^(?:#\s*)?(\d{1,3})(?:[.)])?\s+(.+)$/u.exec(prefix);
    const rank = rankMatch ? Number(rankMatch[1]) : null;
    const detectedName = (rankMatch ? rankMatch[2] : prefix).trim();
    if (!detectedName || detectedName.length > 128) continue;
    if (rank !== null && (rank < 1 || rank > 500)) continue;

    const warnings: string[] = [];
    if (rank === null) warnings.push('Rank not visible; leave unknown unless verified');
    if (!/[KMBT]/i.test(damageRaw)) warnings.push('No K/M/B/T suffix; verify displayed units');
    if (/\d[OolI]|[OolI]\d/.test(damageRaw)) warnings.push('Possible digit/letter confusion');
    candidates.push({ sourceLine, detectedName, rank, damageRaw, warnings });
  }

  const names = new Map<string, number>();
  const ranks = new Map<number, number>();
  for (const candidate of candidates) {
    const key = normalizeOcrName(candidate.detectedName);
    names.set(key, (names.get(key) ?? 0) + 1);
    if (candidate.rank !== null) ranks.set(candidate.rank, (ranks.get(candidate.rank) ?? 0) + 1);
  }
  for (const candidate of candidates) {
    if ((names.get(normalizeOcrName(candidate.detectedName)) ?? 0) > 1)
      candidate.warnings.push('Repeated name in extracted text; check overlapping screenshots');
    if (candidate.rank !== null && (ranks.get(candidate.rank) ?? 0) > 1)
      candidate.warnings.push('Repeated rank; check OCR alignment');
  }
  return candidates.slice(0, 100);
}

/** Only exact normalized names or saved aliases are candidates for automatic selection.
 * No fuzzy/partial matching; ambiguous entries require human member selection.
 */
export function normalizeOcrName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function matchRosterIdentity(
  detectedName: string, roster: RosterIdentity[]
): { memberId: string | null; status: 'EXACT' | 'AMBIGUOUS' | 'UNMATCHED' } {
  const needle = normalizeOcrName(detectedName);
  if (!needle) return { memberId:null, status:'UNMATCHED' };
  const ids = new Set<string>();
  for (const member of roster) {
    if (normalizeOcrName(member.characterName) === needle ||
      (member.aliases ?? []).some(alias => normalizeOcrName(alias) === needle)) {
      ids.add(member.id);
    }
  }
  if (ids.size === 1) return {memberId:[...ids][0],status:'EXACT'};
  return {memberId:null,status:ids.size > 1 ? 'AMBIGUOUS' : 'UNMATCHED'};
}

export type DetectedText = { rawValue: string; boundingBox: { x:number; y:number; width:number; height:number } };

/** Group native device OCR blocks into approximate text rows; never infer unseen rows. */
export function groupTextBlocks(blocks: DetectedText[]): string {
  const valid=blocks.filter(block => block.rawValue.trim() &&
    Number.isFinite(block.boundingBox.x) && Number.isFinite(block.boundingBox.y))
    .sort((a,b)=>a.boundingBox.y-b.boundingBox.y || a.boundingBox.x-b.boundingBox.x);
  const rows: {y:number; height:number; parts:DetectedText[]}[]=[];
  for (const block of valid.slice(0,1500)) {
    const y=block.boundingBox.y, h=Math.max(8,block.boundingBox.height);
    const row=rows.find(r=>Math.abs(r.y-y) <= Math.max(7,Math.min(r.height,h)*0.55));
    if (row) row.parts.push(block);
    else rows.push({y,height:h,parts:[block]});
  }
  return rows.sort((a,b)=>a.y-b.y)
    .map(row=>row.parts.sort((a,b)=>a.boundingBox.x-b.boundingBox.x)
      .map(p=>p.rawValue.trim()).join(' '))
    .join('\n');
}

/** Zero-dependency native device text reading when supported.
 * Native browser TextDetector availability varies; use paste/manual fallback.
 */
export async function readScreenshotWithNativeOcr(file:File):Promise<string> {
  const BrowserDetector=(globalThis as typeof globalThis & {
    TextDetector?: new()=>{detect(image:ImageBitmap):Promise<DetectedText[]>}
  }).TextDetector;
  if (!BrowserDetector) {
    throw new Error('This browser does not provide native on-device text detection. Paste OCR text from a trusted local tool or enter results manually.');
  }
  if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 5*1024*1024)
    throw new Error('Select a JPEG, PNG or WebP screenshot no larger than 5 MB');
  const image=await createImageBitmap(file);
  try {
    const detector=new BrowserDetector();
    return groupTextBlocks(await detector.detect(image));
  } finally {
    image.close();
  }
}
