"use strict";
const test=require('node:test'), assert=require('node:assert/strict');
const {allowedRequest}=require('../scripts/record-real-calendar-demo');
const url=p=>new URL('http://127.0.0.1:8002'+p);
test('movie cut preserves explicit source times and shifts following captions',()=>{
  const {familyEditPlan}=require('../scripts/render-complete-demo');
  const edit={version:1,kind:'familycopilot.demo.family-edit',segments:[
    {kind:'family',duration:4,cues:[]},
    {kind:'capture',sourceStart:0,sourceEnd:4,cues:[]},
    {kind:'movie',duration:4,clickStart:9,clickEnd:10.2,cues:[{start:0.4,seconds:2.15,text:'This movie could be a fun weekend option.'}]},
    {kind:'chapter',duration:3,cues:[{start:0.1,seconds:2,text:'The next step.'}]}
  ]};
  const result=familyEditPlan(edit,{durationSeconds:10});assert.equal(result.duration,15);
  const softened=structuredClone(edit);softened.segments[1].fadeOutSeconds=.8;softened.segments[3].fadeInSeconds=.6;
  assert.equal(familyEditPlan(softened,{durationSeconds:10}).duration,15);
  for(const fadeOutSeconds of [-1,2,NaN,.01]){softened.segments[1].fadeOutSeconds=fadeOutSeconds;assert.throws(()=>familyEditPlan(softened,{durationSeconds:10}));}
  assert.equal(result.captions[0].start,8.4);assert.equal(result.captions[1].start,12.1);
  const waiting=structuredClone(edit);waiting.segments[2].duration=5;waiting.segments[2].loadingSeconds=1;
  assert.equal(familyEditPlan(waiting,{durationSeconds:10}).captions[1].start,13.1);
  waiting.segments[2].loadingStyle='white';
  assert.equal(familyEditPlan(waiting,{durationSeconds:10}).segments[2].loadingStyle,'white');
  waiting.segments[2].loadingStyle='invalid';
  assert.throws(()=>familyEditPlan(waiting,{durationSeconds:10}));
  waiting.segments[2].loadingStyle='freeze';
  for(const loadingSeconds of [-1,2.1,0.01,NaN]){
    waiting.segments[2].loadingSeconds=loadingSeconds;assert.throws(()=>familyEditPlan(waiting,{durationSeconds:10}));
  }
  for(const patch of [{clickStart:-1},{clickEnd:8},{clickEnd:14},{clickEnd:10.21},{speed:2},{duration:8}]){
    const changed=structuredClone(edit);Object.assign(changed.segments[2],patch);assert.throws(()=>familyEditPlan(changed,{durationSeconds:10}));
  }
});
test('public movie capture permits only the exact film document and static dependencies',()=>{
  const {allowedMovieRequest}=require('../scripts/record-demo');
  const film=new URL('https://www.vscinemas.com.tw/vsweb/film/detail.aspx?id=8786');
  assert(allowedMovieRequest(film,'GET','document'));
  assert(!allowedMovieRequest(new URL('https://www.vscinemas.com.tw/vsTicketing/ticketing/ticket.aspx'),'GET','document'));
  assert(!allowedMovieRequest(new URL('https://www.vscinemas.com.tw/vsweb/film/detail.aspx?id=8956'),'GET','document'));
  assert(!allowedMovieRequest(film,'POST','document'));assert(!allowedMovieRequest(film,'GET','xhr'));
  assert(allowedMovieRequest(new URL('https://www.unicornpopcorn.com.tw/ForVsWeb/upload/film/poster.jpg'),'GET','image'));
  assert(!allowedMovieRequest(new URL('https://tracker.invalid/pixel.jpg'),'GET','image'));
});
test('family speech approval is bounded to the reviewed provider voice and request budget',()=>{
  const {validateFamilySpeechRequest}=require('../scripts/render-complete-demo');
  const request={version:1,provider:'Azure AI Speech',resource:'hackathon-VDI-taipei-tts',resourceGroup:'ReceiptModeling',
    subscription:'609bbde3-d152-4d7d-a12b-005e38ac4f27',endpoint:'https://eastus.tts.speech.microsoft.com/cognitiveservices/v1',
    voice:'en-US-JennyNeural',style:'friendly',rate:'-3%',format:'riff-48khz-16bit-mono-pcm',maximumSynthesisRequests:12,
    maximumTextCharacters:1500,credentialReads:1,automaticRetries:0,alternateProviders:false,resourceChanges:false,
    privateCalendarContentSent:false,namesSent:false,narration:['A parent turns to Family Copilot.']};
  assert.equal(validateFamilySpeechRequest(request),request);
  const named={...request,namesSent:true,namedClosingApproved:true,maximumSynthesisRequests:1,maximumTextCharacters:150,
    narration:["Now they are waiting to hear from Parent A. Parent B does not have to figure it all out alone."]};
  assert.throws(()=>validateFamilySpeechRequest(named),/exact historical authorization/);
  for(const change of [{namedClosingApproved:false},{maximumSynthesisRequests:2},{narration:['Other named content.']},
    {narration:[]},{narration:[null]},{narration:[named.narration[0],named.narration[0]]}])assert.throws(()=>validateFamilySpeechRequest({...named,...change}));
  assert.equal(validateFamilySpeechRequest({...request,maximumSynthesisRequests:1,maximumTextCharacters:100}).maximumSynthesisRequests,1);
  assert.throws(()=>validateFamilySpeechRequest({...request,maximumSynthesisRequests:1,narration:['First','Second']}));
  assert.throws(()=>validateFamilySpeechRequest({...request,maximumTextCharacters:5}));
  for(const change of [{endpoint:'https://other.invalid'},{automaticRetries:1},{voice:'other'},{maximumSynthesisRequests:13},
    {narration:[]},{narration:Array(13).fill('Hello')},{narration:[' ']},{narration:['text\ncontrol']},{narration:Array(4).fill('x'.repeat(500))}]){
    assert.throws(()=>validateFamilySpeechRequest({...request,...change}));
  }
});
test('family narration matches captions and fits without cutting or accelerating speech',()=>{
  const {familySpeechPlan}=require('../scripts/render-complete-demo');
  const timeline={duration:9,segments:[{start:0,cues:[{start:0.3,seconds:4,text:'A parent turns to Family Copilot.'}]}]};
  const speech={voice:'en-US-JennyNeural',style:'friendly',rate:'-3%',audio:[{text:'A parent turns to Family Copilot.',seconds:3.2,file:'voice-1.wav',sha256:'a'.repeat(64)}]};
  assert.equal(familySpeechPlan(timeline,speech)[0].start,0.3);
  for(const change of [{text:'Different words'},{seconds:4.1},{seconds:NaN},{file:'../voice.wav'},{sha256:'bad'}]){
    assert.throws(()=>familySpeechPlan(timeline,{...speech,audio:[{...speech.audio[0],...change}]}));
  }
  assert.throws(()=>familySpeechPlan(timeline,{...speech,audio:[]}));
  assert.throws(()=>familySpeechPlan(timeline,{...speech,voice:'other'}));
});
test('paced family voices retain request and WAV provenance and bound every edit',context=>{
  const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{createHash}=require('node:crypto');
  const {loadFamilyVoices}=require('../scripts/render-complete-demo');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'family-voice-test-'));
  context.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const resolve=name=>path.resolve(directory,name),write=(name,value)=>fs.writeFileSync(resolve(name),JSON.stringify(value));
  const hash=name=>createHash('sha256').update(fs.readFileSync(resolve(name))).digest('hex');
  const buffer=Buffer.alloc(44+48000*2*3,1);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);
  buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);
  buffer.writeUInt32LE(48000,24);buffer.writeUInt32LE(96000,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);
  buffer.write('data',36);buffer.writeUInt32LE(buffer.length-44,40);fs.writeFileSync(resolve('voice-1.wav'),buffer);
  const request={version:1,provider:'Azure AI Speech',resource:'hackathon-VDI-taipei-tts',resourceGroup:'ReceiptModeling',
    subscription:'609bbde3-d152-4d7d-a12b-005e38ac4f27',endpoint:'https://eastus.tts.speech.microsoft.com/cognitiveservices/v1',
    voice:'en-US-JennyNeural',style:'friendly',rate:'-3%',format:'riff-48khz-16bit-mono-pcm',maximumSynthesisRequests:1,
    maximumTextCharacters:100,credentialReads:1,automaticRetries:0,alternateProviders:false,resourceChanges:false,
    privateCalendarContentSent:false,namesSent:false,narration:['A family outing.']};
  write('request.json',request);
  const speech={voice:request.voice,style:request.style,rate:request.rate,requestFile:resolve('request.json'),requestSha256:hash('request.json'),
    audio:[{file:'voice-1.wav',seconds:3,text:request.narration[0],sha256:hash('voice-1.wav')}]};
  write('speech.json',speech);
  const reference={file:'speech.json',sha256:hash('speech.json'),index:0,trimStart:0.1,trimEnd:2.8,tempo:1.12};
  const result=loadFamilyVoices([reference],resolve).audio[0];
  assert.equal(result.seconds,2.6999999999999997/1.12);assert.equal(result.sourceSeconds,3);
  assert.equal(result.requestSha256,speech.requestSha256);assert.equal(result.audioFile,resolve('voice-1.wav'));
  write('legacy-script.json',{narration:request.narration});write('legacy-audio.json',speech.audio);
  write('legacy-verification.json',{voice:request.voice,style:request.style,rate:request.rate});
  const legacy={...reference,file:'legacy-verification.json',sha256:hash('legacy-verification.json'),legacy:{
    script:{file:'legacy-script.json',sha256:hash('legacy-script.json')},audio:{file:'legacy-audio.json',sha256:hash('legacy-audio.json')}
  }};
  assert.equal(loadFamilyVoices([legacy],resolve).audio[0].text,request.narration[0]);
  write('legacy-script.json',{narration:['Changed words']});assert.throws(()=>loadFamilyVoices([legacy],resolve));
  for(const change of [{index:1},{index:-1},{trimStart:-1},{trimEnd:3.1},{trimEnd:1},{tempo:1.3},{tempo:NaN},{sha256:'bad'}]){
    assert.throws(()=>loadFamilyVoices([{...reference,...change}],resolve));
  }
  write('request.json',{...request,narration:['Different words.']});
  assert.throws(()=>loadFamilyVoices([reference],resolve));write('request.json',request);
  buffer[100]=20;fs.writeFileSync(resolve('voice-1.wav'),buffer);assert.throws(()=>loadFamilyVoices([reference],resolve));
});
test('family editorial plan keeps consent but excludes reset and Undo footage',()=>{
  const {familyEditPlan}=require('../scripts/render-complete-demo');
  const edit={version:1,kind:'familycopilot.demo.family-edit',segments:[
    {kind:'family',duration:9,cues:[{start:0,seconds:9,text:"Parent B and Parent A are Child's parents."}]},
    {kind:'capture',sourceStart:1.16,sourceEnd:29.6,cues:[]},
    {kind:'chapter',duration:3,cues:[]},
    {kind:'capture',sourceStart:31.6,sourceEnd:53.2,cues:[{start:18,seconds:3.6,text:"Parent A's confirmation is still needed."}]},
    {kind:'family',duration:5,cues:[{start:0,seconds:5,text:'Less coordinating. More living.'}]}
  ]};
  const plan=familyEditPlan(edit,{durationSeconds:57.56});assert.equal(plan.duration,67.04);
  const held=structuredClone(edit);held.segments[1].holdSeconds=3;
  assert.equal(familyEditPlan(held,{durationSeconds:57.56}).duration,70.04);
  held.segments[1].holdSeconds=7;assert.throws(()=>familyEditPlan(held,{durationSeconds:57.56}));
  held.segments[1].holdSeconds=3;held.segments[1].speed=2;
  assert.throws(()=>familyEditPlan(held,{durationSeconds:57.56}));
  assert.equal(plan.segments[3].start,40.44);assert.equal(plan.captions[1].start,58.44);
  assert(!plan.segments.some(segment=>segment.kind==='capture' && segment.sourceEnd>53.2));
  const bad=structuredClone(edit);bad.segments[3].sourceStart=28;assert.throws(()=>familyEditPlan(bad,{durationSeconds:57.56}));
  bad.segments[3].sourceStart=31.601;assert.throws(()=>familyEditPlan(bad,{durationSeconds:57.56}));
  assert.throws(()=>familyEditPlan(edit,{durationSeconds:50}));
  const paced=structuredClone(edit);paced.segments[1].speed=2;paced.segments[1].sourceEnd=29.64;
  paced.segments[0].animationStart=0;paced.segments[0].animationEnd=11.2;
  assert.equal(familyEditPlan(paced,{durationSeconds:57.56}).segments[1].duration,14.24);
  paced.segments[1].speed=3;assert.throws(()=>familyEditPlan(paced,{durationSeconds:57.56}));
  paced.segments[1].speed=1;paced.segments[0].animationEnd=12;
  assert.throws(()=>familyEditPlan(paced,{durationSeconds:57.56}));
});
test('manifest edit planning reuses exact verified speech without rendering or network',context=>{
  const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
  const {createHash}=require('node:crypto');
  const {loadChatEdit,speechKey}=require('../scripts/finish-real-calendar-demo');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'demo-edit-test-'));
  context.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const hash=file=>createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex');
  const write=(file,value)=>fs.writeFileSync(path.join(directory,file),JSON.stringify(value));
  fs.writeFileSync(path.join(directory,'familycopilot-chat-preview.mp4'),'synthetic test source');
  fs.writeFileSync(path.join(directory,'intro.mp4'),'synthetic test intro');
  const buffer=Buffer.alloc(44+48000*2*3,1);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);
  buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(48000,24);buffer.writeUInt32LE(96000,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(buffer.length-44,40);
  fs.mkdirSync(path.join(directory,'voices'));fs.writeFileSync(path.join(directory,'voices/voice-1.wav'),buffer);
  write('voices/audio.json',[{file:'voice-1.wav',seconds:3,sha256:hash('voices/voice-1.wav')}]);
  write('voices/script.json',{narration:['Our family plans.']});
  write('voices/speech-verification.json',{voice:'en-US-JennyNeural',style:'friendly',rate:'-3%'});
  write('capture.json',{syntheticOnly:true,fullDecodePassed:true,forbiddenRequests:0,browserErrors:0,width:1920,height:1080,durationSeconds:6,
    timeline:[{start:0,end:6}],videoSha256:hash('familycopilot-chat-preview.mp4')});
  const manifest={version:1,kind:'familycopilot.demo.edit',capture:'capture.json',captureSha256:hash('capture.json'),
    intro:{file:'intro.mp4',sha256:hash('intro.mp4'),duration:5,text:'An opening.',cue:{start:0.2,seconds:3}},
    narration:['Our family plans.'],voices:[{directory:'voices',index:0}],output:'fresh-edit'};
  const file=path.join(directory,'edit.json');write('edit.json',manifest);
  const result=loadChatEdit(file,directory);
  assert.equal(result.plan.scenes.length,1);assert.equal(result.plan.scenes[0].start,5);
  assert.deepEqual(result.plan.captions,[
    {start:0.2,end:3.2,text:'An opening.'},
    {start:5.25,end:8.25,text:'Our family plans.'}
  ]);
  assert.equal(result.audio[0].speechKey,speechKey('Our family plans.'));
  assert.notEqual(speechKey('Our family plans.'),speechKey('Different words.'));
  assert.notEqual(speechKey('Our family plans.'),speechKey('Our family plans.','another-voice'));
  assert(!fs.existsSync(result.output));
  const capture=JSON.parse(fs.readFileSync(path.join(directory,'capture.json'),'utf8'));
  for(const timeline of [[{start:0,end:7}],[{start:0,end:4},{start:3,end:5}]]){
    write('capture.json',{...capture,timeline});
    write('edit.json',{...manifest,captureSha256:hash('capture.json'),
      narration:timeline.map(()=>manifest.narration[0]),voices:timeline.map(()=>manifest.voices[0])});
    assert.throws(()=>loadChatEdit(file,directory),/beyond the recorded source duration|overlap/);
    assert(!fs.existsSync(result.output));
  }
  write('capture.json',capture);write('edit.json',manifest);
  write('voices/speech-verification.json',{voice:'another-voice',style:'friendly',rate:'-3%'});
  assert.throws(()=>loadChatEdit(file,directory),/Reused voice must be/);
  write('voices/speech-verification.json',{voice:'en-US-JennyNeural',style:'friendly',rate:'-3%'});
  const voice=path.join(directory,'voices/voice-1.wav');
  fs.renameSync(voice,`${voice}.held`);
  assert.throws(()=>loadChatEdit(file,directory),/ENOENT/);
  fs.renameSync(`${voice}.held`,voice);
  const incompatible=Buffer.from(buffer);incompatible.writeUInt32LE(44100,24);
  fs.writeFileSync(voice,incompatible);
  write('voices/audio.json',[{file:'voice-1.wav',seconds:3,sha256:hash('voices/voice-1.wav')}]);
  assert.throws(()=>loadChatEdit(file,directory));
  fs.writeFileSync(voice,buffer);
  write('voices/audio.json',[{file:'voice-1.wav',seconds:3,sha256:hash('voices/voice-1.wav')}]);
  write('edit.json',{...manifest,intro:{...manifest.intro,cue:{start:4,seconds:3}}});
  assert.throws(()=>loadChatEdit(file,directory),/Intro narration cue/);
  write('edit.json',{...manifest,intro:{...manifest.intro,text:'   '}});
  assert.throws(()=>loadChatEdit(file,directory),/Caption text/);
  write('edit.json',{...manifest,intro:{...manifest.intro,cue:{start:0.2,seconds:0.001}}});
  assert.throws(()=>loadChatEdit(file,directory),/collapses at ASS timestamp precision/);
  assert(!fs.existsSync(result.output));
  write('edit.json',{...manifest,narration:['Changed words.']});assert.throws(()=>loadChatEdit(file,directory),/Narration changed/);
  write('edit.json',{...manifest,captureSha256:'incorrect'});assert.throws(()=>loadChatEdit(file,directory));
  write('edit.json',{...manifest,output:'../escape'});assert.throws(()=>loadChatEdit(file,directory),/private demo directory/);
  write('edit.json',manifest);
  fs.renameSync(path.join(directory,'voices/script.json'),path.join(directory,'voices/saved-script.json'));
  fs.symlinkSync(__filename,path.join(directory,'voices/script.json'));
  assert.throws(()=>loadChatEdit(file,directory),/private demo directory/);
  fs.unlinkSync(path.join(directory,'voices/script.json'));
  fs.renameSync(path.join(directory,'voices/saved-script.json'),path.join(directory,'voices/script.json'));
  fs.mkdirSync(result.output);assert.throws(()=>loadChatEdit(file,directory),/already exists/);
});
test('chat narration stays in approved budget and scenes leave space for every voice clip',()=>{
  const {chatNarration,chatPlan}=require('../scripts/finish-real-calendar-demo');
  assert.equal(chatNarration.length,6);assert(chatNarration.join('').length<1500);
  assert.match(chatNarration[0],/^Let's meet Family Copilot/);
  assert.doesNotMatch(chatNarration.join(' '),/CTBC|conflict.free|tickets available|live search/i);
  const timeline=Array.from({length:6},(_,index)=>({start:index*5,end:index*5+5}));
  const result=chatPlan(timeline,timeline.map(()=>({seconds:8})));
  assert.equal(result.scenes[0].start,15.2);
  result.scenes.forEach((scene,index)=>{assert(scene.duration>scene.delay+scene.seconds);if(index)assert.equal(scene.start,result.scenes[index-1].start+result.scenes[index-1].duration);});
  assert.throws(()=>chatPlan(timeline,[]));
});
test('chat planning rejects invalid durations, sparse scenes and unsafe captions before rendering',()=>{
  const {chatPlan}=require('../scripts/finish-real-calendar-demo');
  const timeline=[{start:0,end:5}],audio=[{seconds:3}],texts=['A family outing.'];
  for(const seconds of ['3',NaN,Infinity,null,0,-1,2,25]){
    assert.throws(()=>chatPlan(timeline,[{seconds}],texts,5),/Audio duration/);
  }
  for(const text of ['', '   ', 'Caption\nInjected', 'Caption\u0000hidden', '{\\pos(0,0)}Caption', null]){
    assert.throws(()=>chatPlan(timeline,audio,[text],5),/Caption text/);
  }
  for(const intro of ['5',NaN,Infinity,0,-1,61])assert.throws(()=>chatPlan(timeline,audio,texts,intro),/Intro duration/);
  assert.throws(()=>chatPlan(new Array(1),audio,texts,5),/Source scene/);
  assert.throws(()=>chatPlan(timeline,new Array(1),texts,5),/Audio duration/);
  assert.throws(()=>chatPlan([{start:0,end:5},{start:4,end:9}],[...audio,...audio],[...texts,...texts],5),/overlap/);
  const plan=chatPlan(timeline,audio,texts,5);
  assert.equal(plan.duration,10);
  assert.equal(plan.scenes[0].text,texts[0]);
  assert(Number.isFinite(plan.duration));
});
test('caption planning produces ordered renderable timestamps and rejects collapsed or overlapping cues',()=>{
  const {captionTimeline}=require('../scripts/finish-real-calendar-demo');
  const text='A family outing gives everyone time together. We can explore the choices and check the details before making a plan.';
  const result=captionTimeline([{start:0.125,seconds:4.5,text}],5);
  assert(result.length>1);
  assert.equal(result.map(item=>item.text).join(' '),text);
  assert.equal(result[0].start,0.13);
  assert.equal(result.at(-1).end,4.63);
  result.forEach((item,index)=>{
    assert(item.end>item.start);
    assert(item.end<=5);
    if(index)assert.equal(item.start,result[index-1].end);
  });
  for(const cues of [[],new Array(1),[{start:0,seconds:0.001,text:'Too short.'}],
    [{start:0,seconds:0.01,text}],
    [{start:0,seconds:3,text:'First.'},{start:2,seconds:2,text:'Overlapping.'}],
    [{start:4,seconds:2,text:'Past the end.'}],
    [{start:'0',seconds:2,text:'Invalid.'}],
    [{start:0,seconds:2,text:'   '}]])assert.throws(()=>captionTimeline(cues,5));
  assert.throws(()=>captionTimeline([{start:0,seconds:2,text:'Valid.'}],Infinity));
  assert.throws(()=>captionTimeline([{start:0,seconds:1.006,text:'Rounded end.'}],1.006),/rounds beyond/);
  const boundary=captionTimeline([{start:59.9996,seconds:0.1,text:'Next minute.'}],61);
  assert.deepEqual(boundary,[{start:60,end:60.1,text:'Next minute.'}]);
  const {stamp}=require('../scripts/finish-integrated-demo');
  assert.equal(stamp(boundary[0].start),'00:01:00,000');
  assert.equal(stamp(boundary[0].end,true),'0:01:00.10');
});
test('recording allows exact cache-only scope and never provider sync or clear deletion',()=>{
  const body={cacheOnly:true,refresh:false,acknowledged:true,startDate:'2026-10-09',endDate:'2026-10-15'};
  assert(allowedRequest(url('/api/availability'),'POST',body));
  for(const patch of [{cacheOnly:false},{refresh:true},{acknowledged:false},{endDate:'2026-10-11'}]) assert(!allowedRequest(url('/api/availability'),'POST',{...body,...patch}));
  assert(allowedRequest(url('/api/child/saved'),'POST',body));
  for(const p of ['/api/child/sync','/api/child/import','/api/child/find','/api/activities/basketball']) assert(!allowedRequest(url(p),'POST',body));
  assert(!allowedRequest(url('/api/clear'),'POST',{}));
  assert(!allowedRequest(url('/api/child/clear'),'POST',{reason:'clear'}));
  assert(allowedRequest(url('/api/clear'),'POST',{reason:'leave'}));
  assert(!allowedRequest(new URL('https://example.com/'),'GET'));
  assert(!allowedRequest(url('/api/status'),'GET'));
  assert(allowedRequest(url('/'),'GET'));
});
test('complete story bridges intro, excludes old calendar and delays basketball reveal',()=>{
  const {plan}=require('../scripts/render-complete-demo');
  const {transitionNarration}=require('../scripts/finish-real-calendar-demo');
  assert.match(transitionNarration[0],/^Let's meet Family Copilot\./);
  assert.doesNotMatch(transitionNarration.join(' '),/basketball|everyone is free|automatically/i);
  const story=Array.from({length:8},(_,i)=>({start:40+i*4,end:60+i*4,text:'Test'}));
  story[7]={start:0,end:14.532,text:'Official page'};
  const result=plan({captureStart:1,captureEnd:31},[{seconds:12},{seconds:12}],story,Array.from({length:8},()=>({seconds:12})));
  assert(result.calendarVoiceStart<15.2);
  assert.equal(result.scenes[2].sourceStart,43.5);
  assert.equal(result.scenes[3].delay,6);
  assert.equal(result.scenes.at(-1).kind,'official');
  result.scenes.forEach((s,i)=>{if(i)assert(Math.abs(s.start-result.scenes[i-1].start-result.scenes[i-1].duration)<1e-8);});
});