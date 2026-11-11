/** Upload an approved screenshot only after local OCR review.
 * Metadata can be reused by many result rows; bytes expire after seven days.
 */
export async function uploadMirrorEvidence(
  file: File, onExpired:()=>void
):Promise<{id:string;originalName:string}>{
  if(file.size>5*1024*1024)throw new Error('Screenshot exceeds the 5 MB limit');
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))
    throw new Error('Use a PNG, JPEG or WebP screenshot');
  const data=new FormData();data.append('image',file);
  const res=await fetch('/api/management/attendance/evidence',{
    method:'POST',body:data,credentials:'same-origin',cache:'no-store'
  });
  if(res.status===401)onExpired();
  const response=await res.json().catch(()=>({})) as {
    error?:string;evidence?:{id:string;originalName:string}
  };
  if(!res.ok||!response.evidence)throw new Error(response.error||'Screenshot upload failed');
  return response.evidence;
}
