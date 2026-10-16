'use strict';
// Apps Script HTML bridge avoids relying on unsupported custom CORS headers.
// Staff credentials are sent only to the authenticated bridge, never in a URL.
class SainsSheetBridge {
 constructor(){this.pending=new Map();this.frame=null;this.peer=null;this.origin=null;this.channel=null;this.listener=e=>this.receive(e);}
 googleOrigin(origin){try{const u=new URL(origin);return u.protocol==='https:' && (u.hostname==='script.googleusercontent.com'||u.hostname.endsWith('-script.googleusercontent.com'));}catch{return false;}}
 async connect(endpoint){
  const url=new URL(endpoint);
  if(url.origin!=='https://script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)||url.search||url.hash)throw Error('Enter the deployed Apps Script Web app URL ending /exec.');
  this.close();this.channel=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
  window.addEventListener('message',this.listener);
  this.ready=new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;this.readyTimer=setTimeout(()=>{reject(Error('Google bridge could not connect. Check the deployment URL, Execute as Me / Anyone access, allowed GitHub origin and browser cookie restrictions.'));this.close();},60000);});
  this.frame=document.createElement('iframe');this.frame.hidden=true;this.frame.title='SAINS attendance connection';
  url.searchParams.set('origin',location.origin);url.searchParams.set('channel',this.channel);this.frame.src=url.href;document.body.append(this.frame);
  await this.ready;
 }
 receive(event){
  const m=event.data;if(!m||m.channel!==this.channel||!this.googleOrigin(event.origin))return;
  if(m.type==='sains-ready'&&!this.peer){this.peer=event.source;this.origin=event.origin;clearTimeout(this.readyTimer);this.resolve();return;}
  if(event.source!==this.peer||event.origin!==this.origin||m.type!=='sains-result')return;
  const pending=this.pending.get(m.id);if(!pending)return;clearTimeout(pending.timer);this.pending.delete(m.id);
  if(!m.result||!m.result.ok)pending.reject(Error(m.result?.error||'Attendance request failed.'));else pending.resolve(m.result.data);
 }
 request(payload){
  if(!this.peer)return Promise.reject(Error('Connect to the attendance system first.'));
  const id=crypto.randomUUID();
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Google timed out. Check the connection, then scan again.'));},45000);
   this.pending.set(id,{resolve,reject,timer});this.peer.postMessage({type:'sains-request',channel:this.channel,id,payload},this.origin);});
 }
 close(){
  clearTimeout(this.readyTimer);window.removeEventListener('message',this.listener);if(this.frame)this.frame.remove();this.frame=null;this.peer=null;this.origin=null;
  for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Disconnected.'));}this.pending.clear();
 }
}
window.SainsSheetBridge=SainsSheetBridge;
