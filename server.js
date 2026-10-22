const express=require('express'),http=require('http'),{WebSocketServer}=require('ws');
const {WebcastPushConnection}=require('tiktok-live-connector');
const QS=require('./questions.json');
const USER=process.env.TIKTOK_USER||'faisal.h343',TIME=+process.env.QUESTION_SECONDS||25,KEY=process.env.CONTROL_KEY||'';
const app=express();app.use(express.static('public'));
const server=http.createServer(app),wss=new WebSocketServer({server});
const norm=s=>String(s).toLowerCase().replace(/[\u064B-\u0652\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\p{L}\p{N}]/gu,'');
const players=new Map(),correct=new Map();
let phase='idle',cur=null,endsAt=0,winner=null,answer=null,conn='offline',order=[],t,lastErr='';
const later=(f,ms)=>{clearTimeout(t);t=setTimeout(f,ms)};
const pub=()=>{const m=JSON.stringify({phase,q:cur&&cur.q,left:Math.max(0,endsAt-Date.now()),winner,answer,conn,players:[...players.values()],correctNames:[...correct.values()],total:TIME});wss.clients.forEach(c=>c.readyState===1&&c.send(m))};
const next=()=>{if(!order.length)order=QS.map((_,i)=>i).sort(()=>Math.random()-.5);cur=QS[order.pop()];correct.clear();winner=answer=null;phase='question';endsAt=Date.now()+TIME*1000;pub();later(draw,TIME*1000)};
const draw=()=>{phase='draw';pub();later(()=>{const a=[...correct.values()];winner=a.length?a[Math.floor(Math.random()*a.length)]:'';answer=cur.a[0];phase='result';pub();later(next,9000)},4000)};
const handle=(id,name,msg)=>{const m=norm(msg);
 if(m==='تم'&&!players.has(id)){players.set(id,name);pub()}
 if(phase==='question'&&!correct.has(id)&&cur.a.some(a=>{a=norm(a);return m===a||(a.length>3&&m.includes(a))})){correct.set(id,name);players.set(id,name);pub()}};
app.get('/status',(q,r)=>r.send(conn+' | @'+USER+' | '+lastErr));
app.get('/sim',(q,r)=>{if(KEY&&q.query.key!==KEY)return r.sendStatus(403);handle(q.query.name,q.query.name,q.query.msg||'');r.send('ok')});
wss.on('connection',ws=>{ws.on('message',r=>{let m;try{m=JSON.parse(r)}catch{return}if(KEY&&m.key!==KEY)return;
 if(m.cmd==='start'&&phase==='idle')next();
 if(m.cmd==='stop'){clearTimeout(t);phase='idle';cur=null;pub()}
 if(m.cmd==='skip'&&phase!=='idle')next();
 if(m.cmd==='clear'){players.clear();pub()}});pub()});
function connect(){let done=false;const c=new WebcastPushConnection(USER);
 const retry=e=>{if(done)return;done=true;conn='offline';lastErr=String((e&&e.message)||e||'disconnected');console.log('TikTok:',lastErr);pub();setTimeout(connect,10000)};
 c.on('chat',d=>handle(d.uniqueId,d.nickname||d.uniqueId,d.comment||''));
 c.on('disconnected',()=>retry('disconnected'));
 c.connect().then(()=>{conn='connected';pub()}).catch(retry)}
connect();
server.listen(process.env.PORT||3000);
