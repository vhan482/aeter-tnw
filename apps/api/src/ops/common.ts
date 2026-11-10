import type { Request, Response, NextFunction } from 'express';
export type Middleware = (req: Request, res: Response, next: NextFunction) => void;
export type Guards = { authenticate: Middleware; ready: Middleware; csrf: Middleware };
export type Officer = { id: string; role: 'GUILD_LEADER' | 'OFFICER' | 'CLERK' };
export function actor(res: Response): Officer { return res.locals.officer as Officer; }
export const reviewerOnly: Middleware = (_req, res, next) => {
  if (actor(res).role === 'CLERK') { res.status(403).json({ error: 'Officer review access required' }); return; }
  next();
};
export const noStore: Middleware = (_req,res,next) => { res.setHeader('Cache-Control','no-store'); next(); };
export function wrap(fn:(req:Request,res:Response)=>Promise<unknown>):Middleware {
  return (req,res,next) => { Promise.resolve(fn(req,res)).catch(next); };
}
export function invalid(res:Response) { res.status(400).json({error:'Invalid request'}); }
export function notFound(res:Response) { res.status(404).json({error:'Record not found'}); }
export function conflict(res:Response) { res.status(409).json({error:'Record already exists or changed; reload and retry'}); }
export function pgErrorCode(error:unknown, code:string):boolean {
  let current: unknown=error;
  for(let i=0;i<4 && current && typeof current==='object';i++) {
    if('code' in current && current.code===code)return true;
    current='cause' in current ? current.cause : null;
  }
  return false;
}
export function handleConstraint(error:unknown,res:Response):boolean {
  if(pgErrorCode(error,'23505')){conflict(res);return true;}
  if(pgErrorCode(error,'23503')){invalid(res);return true;}
  return false;
}
