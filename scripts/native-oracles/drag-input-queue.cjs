// Execute immutable v9's actual queued input functions, without gameplay mocks.
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const source=execFileSync('git',['show','production-benchmark-v9:src/modules/drag-core.ts'],{encoding:'utf8'});
const start=source.indexOf('  function processQueuedMove()');
const end=source.indexOf('  function onUp(e)',start);
if(start<0||end<0)throw Error('Immutable v9 queued input functions missing');
const block=source.slice(start,end),drag={t:{},_moveRaf:null,_pendingMoveEvent:null};
let scheduled=0,callback,painted=[];
const onMove=new Function('drag','requestAnimationFrame','processMove','isActivePointerEvent','eventPointerId','performance',block+';return onMove;')(
    drag,f=>{scheduled++;callback=f;return scheduled},e=>painted.push(e.global.x),()=>true,e=>e.pointerId,{now:()=>0});
for(let x=1;x<=12;x++)onMove({pointerId:1,global:{x,y:0}});
const before={events:12,scheduled,painted:painted.length};
if(scheduled!==1||painted.length!==0)throw Error('v9 queued admission mismatch');
callback();
if(painted.length!==1||painted[0]!==12)throw Error('v9 latest sample mismatch');
onMove({pointerId:1,global:{x:24,y:0}});callback();
if(scheduled!==2||painted.length!==2||painted[1]!==24)throw Error('v9 successor frame mismatch');
process.stdout.write(JSON.stringify({reference:'production-benchmark-v9',path:'src/modules/drag-core.ts',functionSHA256:createHash('sha256').update(block).digest('hex'),before,after:{scheduled,painted}},null,2)+'\n');
