import { DEF, HEADERS, SHEETS, emptyData, type GuildData, type RecordRow, type SheetName } from '../types';

function asText(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('text' in v) return String(v.text ?? '');
    if ('result' in v) return asText(v.result);
    if ('richText' in v && Array.isArray(v.richText)) return v.richText.map((p: {text?:string})=>p.text ?? '').join('');
    return '';
  }
  return String(v);
}

export async function readGuildWorkbook(file: File): Promise<GuildData> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await file.arrayBuffer()) as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const output = emptyData();
  for (const sheetName of SHEETS) {
    const sheet = wb.getWorksheet(sheetName);
    if (!sheet) throw new Error(`Required worksheet missing: ${sheetName}`);
    const columnIndexes = new Map<string,number>();
    sheet.getRow(1).eachCell((cell, col) => columnIndexes.set(asText(cell.value).trim(), col));
    const missing = HEADERS[sheetName].filter(h => !columnIndexes.has(h));
    if (missing.length) throw new Error(`${sheetName}: missing column(s): ${missing.join(', ')}`);
    const seen = new Set<string>();
    for (let n = 2; n <= sheet.rowCount; n++) {
      const row: RecordRow = {};
      for (const h of HEADERS[sheetName]) {
        const c = columnIndexes.get(h);
        row[h] = c ? asText(sheet.getRow(n).getCell(c).value).trim() : '';
      }
      const id = row[DEF[sheetName].idKey];
      if (!id) continue;
      if (seen.has(id)) throw new Error(`${sheetName}: duplicate ID ${id}`);
      seen.add(id);
      output[sheetName].push(row);
    }
  }
  return output;
}

export async function saveGuildWorkbook(data: GuildData): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator='TNW Guild Operations';
  const dashboard = wb.addWorksheet('Dashboard');
  dashboard.addRow(['TNW / GUILD OPERATIONS']);
  dashboard.addRow(['Active Members', data.Members.filter(m=>m.Status==='Active').length]);
  dashboard.addRow(['Guild Events', data.Events.length]);
  const taken = data.Attendance.filter(a=>['Present','Late','Absent'].includes(a['Attendance Status']));
  const present = taken.filter(a=>['Present','Late'].includes(a['Attendance Status'])).length;
  dashboard.addRow(['Attendance Rate', taken.length ? `${(present/taken.length*100).toFixed(1)}%` : 'N/A']);
  dashboard.addRow(['Pending Evidence',data.Evidence.filter(e=>e['Review Status']==='Pending').length]);
  dashboard.addRow([]);
  dashboard.addRow(['Source of truth', 'Demo mode: browser local data; regularly export an Excel backup.']);
  dashboard.getColumn(1).width=27; dashboard.getColumn(2).width=60;
  dashboard.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'},size:17};dashboard.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF182943'}};
  for (const sheetName of SHEETS) {
    const ws = wb.addWorksheet(sheetName);
    ws.addRow(HEADERS[sheetName]);
    for (const row of data[sheetName]) ws.addRow(HEADERS[sheetName].map(h=>row[h]??''));
    ws.getRow(1).eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF182943'}};cell.font={bold:true,color:{argb:'FFFFFFFF'}};});
    ws.getRow(1).height=26;
    ws.columns = HEADERS[sheetName].map(h=>({width: Math.min(38,Math.max(15,h.length+4))}));
    ws.views=[{state:'frozen',ySplit:1}];
    if (ws.rowCount>1) ws.autoFilter={from:{row:1,column:1},to:{row:ws.rowCount,column:HEADERS[sheetName].length}};
  }
  const output = await wb.xlsx.writeBuffer();
  const blob = new Blob([output as BlobPart], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download=`TNW_Guild_Ops_${new Date().toISOString().slice(0,10)}.xlsx`;
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}

export function recordCount(data: GuildData, sheet: SheetName): number {return data[sheet].length;}
