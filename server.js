import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { properties as seed } from './src/seed.js';
const dataDir = process.env.DATA_DIR || './data';
mkdirSync(dataDir, {recursive:true});
const db = new DatabaseSync(join(dataDir,'homestead.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT PRIMARY KEY, body TEXT NOT NULL);');
const all = kind => db.prepare('SELECT body FROM records WHERE kind=? ORDER BY rowid DESC').all(kind).map(r=>JSON.parse(r.body));
const put = (kind, value) => db.prepare('INSERT OR REPLACE INTO records(kind,id,body) VALUES (?,?,?)').run(kind,value.id,JSON.stringify(value));
if (!db.prepare("SELECT id FROM records WHERE kind='initialized'").get()) { for (const p of seed) put('properties',p); put('initialized',{id:'initialized'}); }
const respond = (res, status, body) => {res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
const text = (v,max=2000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
function validate(kind,b) {
 if (kind==='properties') return ['title','location','city','type','description'].every(k=>text(b[k])) && ['Sale','Rent'].includes(b.purpose) && ['price','beds','baths','area'].every(k=>Number.isFinite(b[k]) && b[k]>=0) && b.price>0 && text(b.image) && /^https:\/\//.test(b.image);
 if (kind==='leads') return text(b.name,100) && text(b.email,254) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) && text(b.phone,30) && text(b.propertyId,100) && all('properties').some(p=>p.id===b.propertyId) && text(b.message) && ['New','Contacted','Closed'].includes(b.status);
 if (kind==='viewings') return text(b.name,100) && text(b.propertyId,100) && all('properties').some(p=>p.id===b.propertyId) && text(b.date,100) && Number.isFinite(Date.parse(b.date)) && ['Scheduled','Completed','Cancelled'].includes(b.status);
 return false;
}
let vite;
if (process.env.NODE_ENV !== 'production') vite = await (await import('vite')).createServer({server:{middlewareMode:true},appType:'spa'});
const server = http.createServer(async (req,res)=>{
 const pathname = new URL(req.url,'http://localhost').pathname;
 if (pathname.startsWith('/api/')) {
  const [, ,kind,id] = pathname.split('/');
  if (!['properties','leads','viewings'].includes(kind)) return respond(res,404,{error:'Not found'});
  if(req.method==='GET') return respond(res,200,all(kind));
  if(req.method==='DELETE' && id) {
   if (kind==='properties') for(const child of ['leads','viewings']) for(const record of all(child)) if(record.propertyId===id) db.prepare('DELETE FROM records WHERE id=? AND kind=?').run(record.id,child);
   const result = db.prepare('DELETE FROM records WHERE id=? AND kind=?').run(id,kind);
   return respond(res,result.changes?200:404,result.changes?{ok:true}:{error:'Not found'});
  }
  if (['POST','PUT'].includes(req.method)) {
   try {
    let raw='';for await(const chunk of req) {raw+=chunk;if(raw.length>30000)return respond(res,413,{error:'Request too large'});}
    const body=JSON.parse(raw);
    if(!validate(kind,body))return respond(res,400,{error:'Please check the required fields.'});
    if(req.method==='PUT' && (!id || !db.prepare('SELECT id FROM records WHERE id=? AND kind=?').get(id,kind))) return respond(res,404,{error:'Not found'});
    const value={...body,id:req.method==='PUT'?id:randomUUID(),createdAt:body.createdAt || new Date().toISOString()};put(kind,value);return respond(res,req.method==='POST'?201:200,value);
   } catch {return respond(res,400,{error:'Invalid request'});}
  }
  return respond(res,405,{error:'Method not allowed'});
 }
 if(vite)return vite.middlewares(req,res);
 const root=resolve('dist');let decoded;try{decoded=decodeURIComponent(pathname)}catch{res.writeHead(400);return res.end('Invalid URL')}let file=resolve(root,'.'+decoded);
 if(file!==root && !file.startsWith(root+'/')){res.writeHead(403);return res.end();}
 if(!existsSync(file)||!extname(file))file=join(root,'index.html');
 try {const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(readFileSync(file));}catch{res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.PORT || 3000),'0.0.0.0',()=>console.log('Homestead listening on port '+(process.env.PORT || 3000)));
