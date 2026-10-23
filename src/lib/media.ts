const DB='tnw-guild-media-v1', STORE='screenshots';
function open():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
}
async function transact<T>(mode:IDBTransactionMode,runner:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T> {
  const db=await open();
  try {return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode);const request=runner(tx.objectStore(STORE));
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    tx.onerror=()=>reject(tx.error);
  });} finally {db.close();}
}
export const storeScreenshot=(id:string, file:File)=>transact('readwrite',s=>s.put(file,id));
export const readScreenshot=(id:string)=>transact<Blob|undefined>('readonly',s=>s.get(id));
export const removeScreenshot=(id:string)=>transact('readwrite',s=>s.delete(id));
