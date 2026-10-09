import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
test('property, lead and viewing workflow persists and validates data',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'homestead-test-'));let child;
 async function start(){child=spawn(process.execPath,['server.js'],{env:{...process.env,NODE_ENV:'production',PORT:'3109',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});let log='';await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Server readiness timeout: '+log)),10000);child.stdout.on('data',b=>{log+=b;if(log.includes('listening')){clearTimeout(t);resolve()}});child.once('exit',code=>{clearTimeout(t);reject(Error('Server exited '+code))})})}
 async function stop(){const done=once(child,'exit');child.kill();await done}
 async function request(path,method='GET',body){const r=await fetch('http://127.0.0.1:3109'+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()}}
 try{
 await start();const initial=await request('/api/properties');assert.equal(initial.status,200);assert.equal(initial.body.length,6);
 const p={...initial.body[0],title:'Test property',price:1234567};delete p.id;
 let result=await request('/api/properties','POST',p);assert.equal(result.status,201);const property=result.body;
 result=await request('/api/properties/'+property.id,'PUT',{...property,price:7654321});assert.equal(result.body.price,7654321);
 assert.equal((await request('/api/properties','POST',{...p,price:-1})).status,400);
 const lead={name:'Demo Client',email:'demo@example.com',phone:'08000000000',propertyId:property.id,message:'Please arrange a viewing.',status:'New'};
 assert.equal((await request('/api/leads','POST',{...lead,email:'invalid'})).status,400);
 result=await request('/api/leads','POST',lead);assert.equal(result.status,201);const savedLead=result.body;
 assert.equal((await request('/api/leads/'+savedLead.id,'PUT',{...savedLead,status:'Contacted'})).body.status,'Contacted');
 result=await request('/api/viewings','POST',{name:'Demo Client',propertyId:property.id,date:'2026-12-01T09:00:00.000Z',status:'Scheduled'});assert.equal(result.status,201);const viewing=result.body;
 assert.equal((await request('/api/viewings/'+viewing.id,'PUT',{...viewing,status:'Completed'})).body.status,'Completed');
 await stop();await start();assert.equal((await request('/api/properties')).body.length,7);assert.equal((await request('/api/leads')).body[0].status,'Contacted');
 assert.equal((await request('/api/properties/'+property.id,'DELETE')).status,200);
 assert.equal((await request('/api/leads')).body.length,0);assert.equal((await request('/api/viewings')).body.length,0);
 assert.equal((await request('/api/properties/missing','PUT',p)).status,404);
 const home=await fetch('http://127.0.0.1:3109/');assert.equal(home.status,200);assert.match(await home.text(),/Homestead/);
 }finally{if(child?.exitCode===null)await stop();rmSync(dir,{recursive:true,force:true})}
});
