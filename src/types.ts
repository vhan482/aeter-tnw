export const SHEETS = ['Members', 'Gear', 'Events', 'Attendance', 'Performance', 'Evidence'] as const;
export type SheetName = typeof SHEETS[number];
export type RecordRow = Record<string, string>;
export type GuildData = Record<SheetName, RecordRow[]>;
export const emptyData = (): GuildData => ({ Members: [], Gear: [], Events: [], Attendance: [], Performance: [], Evidence: [] });
export type Field = { key: string; label: string; type?: 'text' | 'date' | 'number' | 'select' | 'time' | 'textarea'; options?: string[]; required?: boolean; reference?: 'member'|'event'; hint?: string };
export type Definition = { prefix: string; description: string; idKey: string; fields: Field[] };
export const DEF: Record<SheetName, Definition> = {
  Members: { prefix: 'MBR', description: 'One profile per guild character. IDs stay stable when names change.', idKey: 'Member ID', fields: [
    {key:'Character Name',label:'Character name',required:true}, {key:'Class',label:'Class / job',required:true},
    {key:'Role',label:'Guild combat role',type:'select',options:['DPS','Tank','Healer','Support','Flex']},
    {key:'Build',label:'Build / specialization'}, {key:'Guild Rank',label:'Guild rank'},
    {key:'Status',label:'Roster status',type:'select',options:['Active','Inactive','On Leave','Left']},
    {key:'Joined Date',label:'Joined date',type:'date'}, {key:'Discord Name',label:'Discord name'},
    {key:'Notes',label:'Notes',type:'textarea'}
  ]},
  Gear: { prefix: 'GR', description: 'Each row is one equipment slot at a point in time. Preserve old snapshots.', idKey:'Gear ID', fields: [
    {key:'Member ID',label:'Member',reference:'member',required:true}, {key:'Snapshot Date',label:'Snapshot date',type:'date',required:true},
    {key:'Slot',label:'Equipment slot',type:'select',options:['Weapon','Off-hand','Armor','Cape','Shoes','Accessory 1','Accessory 2','Headgear','Other'],required:true},
    {key:'Item Name',label:'Item name'}, {key:'Refine',label:'Refine (+)',type:'number'},
    {key:'Special Skill',label:'Special skill / affix'}, {key:'Cards',label:'Cards'},
    {key:'Runes',label:'Runes / rune engine'}, {key:'Resonance',label:'Resonance'},
    {key:'Screenshot Reference',label:'Evidence filename / URL'},
    {key:'Verified',label:'Human verified',type:'select',options:['No','Yes']}, {key:'Notes',label:'Notes',type:'textarea'}
  ]},
  Events: { prefix:'EVT', description:'Create an event before taking attendance or recording results.', idKey:'Event ID', fields:[
    {key:'Event Name',label:'Event name',required:true}, {key:'Event Type',label:'Type / mode',required:true},
    {key:'Event Date',label:'Event date',type:'date',required:true}, {key:'Start Time',label:'Start time',type:'time'},
    {key:'End Time',label:'End time',type:'time'}, {key:'Status',label:'Event status',type:'select',options:['Scheduled','Completed','Cancelled']},
    {key:'Notes',label:'Notes',type:'textarea'}
  ]},
  Attendance: { prefix:'ATT', description:'Present + Late counts as attendance. Unrecorded players are not automatically Absent.', idKey:'Attendance ID', fields:[
    {key:'Event ID',label:'Event',reference:'event',required:true}, {key:'Member ID',label:'Member',reference:'member',required:true},
    {key:'Attendance Status',label:'Status',type:'select',options:['Present','Late','Absent','Excused','Unconfirmed'],required:true},
    {key:'Check-in Time',label:'Check-in time',type:'time'}, {key:'Screenshot Reference',label:'Evidence filename / URL'},
    {key:'Confirmed By',label:'Confirmed by'}, {key:'Notes',label:'Notes',type:'textarea'},
    {key:'Recorded At',label:'Recorded at',type:'date'}
  ]},
  Performance: { prefix:'PER', description:'Use separate metric rows per member and event. No arbitrary cross-role score is imposed.', idKey:'Performance ID', fields:[
    {key:'Event ID',label:'Event',reference:'event',required:true}, {key:'Member ID',label:'Member',reference:'member',required:true},
    {key:'Metric Name',label:'Metric',type:'select',options:['Kills','Deaths','Assists','Damage Dealt','Damage Taken','Healing','Objective Points','Participation','Other'],required:true},
    {key:'Metric Value',label:'Value',type:'number',required:true}, {key:'Unit',label:'Unit'},
    {key:'Role Context',label:'Role context'}, {key:'Screenshot Reference',label:'Evidence filename / URL'},
    {key:'Verified',label:'Human verified',type:'select',options:['No','Yes']}, {key:'Notes',label:'Notes',type:'textarea'},
    {key:'Recorded At',label:'Recorded at',type:'date'}
  ]},
  Evidence: { prefix:'IMG', description:'Register screenshot evidence, then approve only after checking the extracted data.', idKey:'Evidence ID', fields:[
    {key:'Uploaded At',label:'Captured / uploaded date',type:'date'},
    {key:'Category',label:'Screenshot category',type:'select',options:['Roster','Gear','Attendance','Performance','Other']},
    {key:'Member ID',label:'Member (optional)',reference:'member'}, {key:'Event ID',label:'Event (optional)',reference:'event'},
    {key:'Filename',label:'Screenshot filename',required:true},
    {key:'Review Status',label:'Review status',type:'select',options:['Pending','Approved','Rejected']},
    {key:'Source Reference',label:'Source URL / chat reference'}, {key:'Notes',label:'Review notes',type:'textarea'}
  ]}
};
export const HEADERS: Record<SheetName,string[]> = Object.fromEntries(SHEETS.map(s=>[s,[DEF[s].idKey,...DEF[s].fields.map(f=>f.key)]])) as Record<SheetName,string[]>;
export const displayRecord = (row:RecordRow, s:SheetName):string => s==='Members' ? row['Character Name'] : s==='Events' ? `${row['Event Name']} · ${row['Event Date']}` : row[DEF[s].idKey];
