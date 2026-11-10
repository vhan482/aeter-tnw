import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, mkdir, readFile, readdir, stat, statfs, unlink } from 'node:fs/promises';
import { basename, isAbsolute, join, resolve } from 'node:path';
import type { Express, Request, Response, NextFunction } from 'express';
import type pg from 'pg';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { rateLimit } from 'express-rate-limit';
import type { ApiConfig } from '../config.js';
import { attendanceEvidence } from '../db/schema.js';
import { actor, invalid, noStore, notFound, wrap, type Guards } from '../ops/common.js';

export const EVIDENCE_DAYS = 7;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 250 * 1024 * 1024;
const FREE_DISK_BUFFER = 512 * 1024 * 1024;
const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']);
const validStorageName = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const httpStatus = (code:number,error:string,res:Response)=>res.status(code).json({error});
export function evidenceDirectory(config:ApiConfig):string {
  if (!isAbsolute(config.UPLOAD_DIR)) {
    throw new Error('UPLOAD_DIR must be an absolute path');
  }
  return resolve(config.UPLOAD_DIR);
}
async function prepare(dir:string) {
  await mkdir(dir,{recursive:true,mode:0o700});
  await chmod(dir,0o700);
}
async function totalBytes(dir:string):Promise<number> {
  const entries=await readdir(dir,{withFileTypes:true});
  let total=0;
  for(const e of entries){
    if(!e.isFile()||!validStorageName.test(e.name))continue;
    const s=await stat(join(dir,e.name));total+=s.size;
  }
  return total;
}
function safeOriginal(value:string) {
  const clean=basename(value.replaceAll('\\','/')).replace(/[\x00-\x1f\x7f]/g,'').trim();
  return clean.slice(0,160)||'image';
}
async function getRecord(id:string,db:ReturnType<typeof drizzle>) {
  const [row]=await db.select().from(attendanceEvidence).where(eq(attendanceEvidence.id,id)).limit(1);
  return row;
}
function external(row:typeof attendanceEvidence.$inferSelect,exists=true) {
  const expired=!!row.deletedAt || row.expiresAt.getTime()<=Date.now();
  return {
    id:row.id,originalName:row.originalName,mimeType:row.mimeType,bytes:row.bytes,
    sha256:row.sha256,createdAt:row.createdAt,expiresAt:row.expiresAt,
    status:expired?'EXPIRED':exists?'AVAILABLE':'MISSING'
  };
}

export function registerEvidenceRoutes(app:Express,pool:pg.Pool,guards:Guards,config:ApiConfig){
  const db=drizzle(pool);
  const dir=evidenceDirectory(config);
  const root='/api/management/attendance/evidence';
  app.use(root,noStore,guards.authenticate,guards.ready);
  const upload=multer({
    storage:multer.diskStorage({
      destination(_req,_file,cb){cb(null,dir);},
      filename(_req,_file,cb){cb(null,randomUUID());}
    }),
    fileFilter(_req,file,cb){
      // Client MIME is only a preliminary filter; magic bytes are validated below.
      if(!allowed.has(file.mimetype)){cb(new Error('Unsupported image type'));return;}
      cb(null,true);
    },
    limits:{fileSize:MAX_FILE_BYTES,files:1,fields:0,parts:1,fieldNameSize:60}
  }).single('image');
  const quota: (req:Request,res:Response,next:NextFunction)=>void =
    (_req,res,next)=>{
      void (async()=>{
        await prepare(dir);
        const disk=await statfs(dir);
        if(Number(disk.bavail)*Number(disk.bsize)<FREE_DISK_BUFFER){
          httpStatus(507,'Insufficient free server storage',res);return;
        }
        if(await totalBytes(dir)>=MAX_TOTAL_BYTES){
          httpStatus(507,'Screenshot storage limit reached; try after retention cleanup',res);return;
        }
        next();
      })().catch(next);
    };
  const rate=rateLimit({
    windowMs:60*60*1000,limit:30,standardHeaders:'draft-7',legacyHeaders:false,
    message:{error:'Too many screenshot uploads; try later'}
  });
  const multipart: (req:Request,res:Response,next:NextFunction)=>void =
    (req,res,next)=>{
      upload(req,res,(error?:any)=>{
        if(!error){next();return;}
        if(error instanceof multer.MulterError){
          if(error.code==='LIMIT_FILE_SIZE'){httpStatus(413,'Image exceeds 5 MB',res);return;}
          httpStatus(400,'Invalid multipart upload',res);return;
        }
        httpStatus(415,'Unsupported or invalid image upload',res);
      });
    };

  // Ordered: authenticated session -> origin check -> rate/quota -> disk write -> magic bytes.
  app.post(root,guards.csrf,rate,quota,multipart,wrap(async(req,res)=>{
    const file=req.file;
    if(!file){invalid(res);return;}
    let retained=false;
    try{
      const bytes=await readFile(file.path);
      const actual=await fileTypeFromBuffer(bytes);
      if(!actual||!allowed.has(actual.mime)||actual.mime!==file.mimetype){
        httpStatus(415,'File is not a supported JPEG, PNG or WebP image',res);return;
      }
      if(!validStorageName.test(file.filename)){
        httpStatus(400,'Invalid stored filename',res);return;
      }
      const disk=await statfs(dir);
      const used=await totalBytes(dir);
      if(used>MAX_TOTAL_BYTES||Number(disk.bavail)*Number(disk.bsize)<FREE_DISK_BUFFER){
        httpStatus(507,'Screenshot quota or free space threshold reached',res);return;
      }
      const originalName=safeOriginal(file.originalname);
      const expiresAt=new Date(Date.now()+EVIDENCE_DAYS*24*60*60*1000);
      const [record]=await db.insert(attendanceEvidence).values({
        id:file.filename,storedName:file.filename,originalName,mimeType:actual.mime,
        bytes:file.size,sha256:createHash('sha256').update(bytes).digest('hex'),
        expiresAt,uploadedBy:actor(res).id
      }).returning();
      retained=true;
      res.status(201).json({evidence:external(record)});
    }finally{
      if(!retained)await unlink(file.path).catch(()=>undefined);
    }
  }));

  app.get(root+'/:id/meta',wrap(async(req,res)=>{
    const id=req.params.id;
    if(!validStorageName.test(id)){invalid(res);return;}
    const row=await getRecord(id,db);
    if(!row){notFound(res);return;}
    let exists=true;
    if(!row.deletedAt && row.expiresAt.getTime()>Date.now()){
      try{await stat(join(dir,row.storedName));}catch{exists=false;}
    }
    res.json({evidence:external(row,exists)});
  }));

  app.get(root+'/:id/file',wrap(async(req,res)=>{
    const id=req.params.id;
    if(!validStorageName.test(id)){invalid(res);return;}
    const row=await getRecord(id,db);
    if(!row){notFound(res);return;}
    if(row.deletedAt||row.expiresAt.getTime()<=Date.now()){
      httpStatus(410,'Screenshot retention period expired',res);return;
    }
    if(!validStorageName.test(row.storedName)){notFound(res);return;}
    const full=join(dir,row.storedName);
    try{await stat(full);}catch{httpStatus(410,'Screenshot no longer available',res);return;}
    res.setHeader('Content-Type',row.mimeType);
    res.setHeader('Content-Disposition','inline; filename="evidence.'+({ 'image/png':'png','image/jpeg':'jpg','image/webp':'webp' }[row.mimeType]||'bin')+'"');
    res.setHeader('Cache-Control','no-store, private');
    res.setHeader('Content-Security-Policy','sandbox');
    createReadStream(full).on('error',()=>{
      if(!res.headersSent)res.status(410).end();
      else res.destroy();
    }).pipe(res);
  }));
}
