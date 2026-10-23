import { emptyData, SHEETS, type GuildData } from '../types';
const KEY='tnw-guild-ops-v1';
export function load():GuildData {
  try {
    const raw=JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<GuildData>|null;
    if(!raw || typeof raw !=='object') return emptyData();
    const safe=emptyData();for(const s of SHEETS) safe[s]=Array.isArray(raw[s])? raw[s] : [];
    return safe;
  } catch { return emptyData(); }
}
export function save(data:GuildData):void {localStorage.setItem(KEY,JSON.stringify(data));}
