import 'dotenv/config';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import { attendanceEvidence } from '../db/schema.js';
import { loadConfig } from '../config.js';
import { evidenceDirectory } from '../evidence/routes.js';

const validName=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORPHAN_GRACE_MS=60*60*1000;

/** Remove image bytes, not historical metadata or linked checkpoints. */
export async function expireEvidence(pool:pg.Pool,dir:string,now=new Date()) {
  const db=drizzle(pool);
  let expired=0,orphans=0;
  // Bounded batches permit many uploads without one enormous DB operation.
  for(;;){
    const rows=await db.select().from(attendanceEvidence)
      .where(and(isNull(attendanceEvidence.deletedAt),lte(attendanceEvidence.expiresAt,now)))
      .limit(100);
    if(!rows.length)break;
    for(const row of rows){
      if(!validName.test(row.storedName))throw new Error('Invalid stored evidence name; manual review required');
      const path=join(dir,row.storedName);
      try{await unlink(path);}catch(error){
        if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
      }
      const result=await db.update(attendanceEvidence).set({deletedAt:now})
        .where(and(eq(attendanceEvidence.id,row.id),isNull(attendanceEvidence.deletedAt))).returning({id:attendanceEvidence.id});
      expired+=result.length;
    }
  }
  // Crash/aborted uploads might lack DB rows. Remove only safe generated names
  // older than 1 hour, never active uploads or unrelated directory content.
  const known=new Set((await db.select({storedName:attendanceEvidence.storedName})
    .from(attendanceEvidence)).map(row=>row.storedName));
  let entries;
  try{entries=await readdir(dir,{withFileTypes:true});}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {expired,orphans};throw error;}
  for(const entry of entries){
    if(!entry.isFile()||!validName.test(entry.name)||known.has(entry.name))continue;
    const path=join(dir,entry.name);
    const info=await stat(path);
    if(now.getTime()-info.mtimeMs<ORPHAN_GRACE_MS)continue;
    try{await unlink(path);orphans++;}
    catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  }
  return {expired,orphans};
}

async function main(){
  const config=loadConfig(process.env);
  const pool=new pg.Pool({connectionString:config.DATABASE_URL,max:1});
  try{
    const result=await expireEvidence(pool,evidenceDirectory(config));
    // Logs only aggregate counts; no filenames, uploader IDs, or private data.
    console.log(`Evidence retention sweep: ${result.expired} expired, ${result.orphans} orphaned files removed`);
  }finally{await pool.end();}
}
if(process.argv[1] && /cleanup-evidence\.(ts|js)$/.test(process.argv[1])){
  main().catch(error=>{
    console.error('Evidence cleanup failed:',error instanceof Error?error.name:'unknown');
    process.exitCode=1;
  });
}
