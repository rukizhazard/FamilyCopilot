"use strict";
// Fixed real capture; no calendar access. Speech sends only the generic script below.
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'), {createHash}=require('node:crypto');
const {wavInfo,escapeXML,stamp,chunks}=require('./finish-integrated-demo');
const root=path.resolve(__dirname,'..');
const chatMode=['--synthesize-chat-approved','--render-chat-offline'].includes(process.argv[2]);
const source=path.join(root,chatMode?'browser-artifacts/demo/chat-preview-KQBZ79':'browser-artifacts/demo/real-calendar-LHXjcP');
const captureFile=path.join(source,chatMode?'manifest.json':'capture.json');
const intro=path.join(root,'browser-artifacts/demo/family-intro-6gKRQp/familycopilot-family-intro.mp4');
const fullStory=['--synthesize-full-approved','--render-full-offline'].includes(process.argv[2]);
const output=path.join(source,chatMode?'jenny-intro':fullStory?'complete-story':'finished');
const chatNarration=[
  "Let's meet Family Copilot. A little time together starts with the things your family enjoys.",
  "What could we do together in October? Let's explore a few ideas.",
  "The family calendar appears right here in the conversation, so we can review our plans.",
  "A basketball game or a movie? Here are two ideas to explore, with a few details still worth checking.",
  "October feels too far away. How about this weekend?",
  "Here's a closer movie option to consider. Less time coordinating, more time together."
];
const transitionNarration=[
  "Let's meet Family Copilot. Here are our plans for the weekend, together in one view. We can look across the family calendars and consider where an outing might fit.",
  "With those commitments in view, let's look for something to do within these dates. Next, we'll bring in the family's interests, and turn a possible opening into an idea worth exploring."
];
const narration=chatMode?chatNarration:fullStory?transitionNarration:[
  "Our calendars are already loaded. Now we can look at the weekend together, instead of piecing together separate plans. We can see where commitments fall and which times deserve a closer look.",
  "With the week's commitments in view, the next question is what we'd enjoy doing together. Let's explore an activity that matches our interests, then check the details before deciding."
];
const introText="Between work, school, and everyday routines, family time can be easy to put off. This weekend, let's do something together. But when could we go, and what would everyone enjoy?";
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(name,data)=>fs.writeFileSync(path.join(output,name),JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
function speechKey(text, voice='en-US-JennyNeural', style='friendly', rate='-3%'){
  return createHash('sha256').update(JSON.stringify({text,voice,style,rate,format:'riff-48khz-16bit-mono-pcm'})).digest('hex');
}
function validateCaption(text){
  assert(typeof text==='string' && text.trim().length>0 && text.length<=1000 && !/[\x00-\x1f\x7f{}\\]/.test(text),
    'Caption text must be nonblank plain text without controls or ASS directives');
}
function chatInputs(source, captureFile){
  const capture=read(captureFile),raw='familycopilot-chat-preview.mp4';
  assert(capture.syntheticOnly===true && capture.fullDecodePassed===true && capture.forbiddenRequests===0 && capture.browserErrors===0);
  assert.equal(capture.width,1920);assert.equal(capture.height,1080);
  assert(Array.isArray(capture.timeline) && capture.timeline.length>0 && capture.timeline.length<=12);
  assert(Number.isFinite(capture.durationSeconds) && capture.durationSeconds>0);
  assert.equal(hash(path.join(source,raw)),capture.videoSha256);
  return {...capture,raw};
}
function loadChatEdit(file, artifactRoot=path.join(root,'browser-artifacts/demo')){
  const base=fs.realpathSync(artifactRoot),manifestFile=fs.realpathSync(file);
  const inside=target=>assert(target.startsWith(base+path.sep),'Production paths must stay inside the private demo directory');
  inside(manifestFile);
  const manifest=read(manifestFile),resolve=value=>{
    assert(typeof value==='string' && value.length>0);
    const resolved=fs.realpathSync(path.resolve(path.dirname(manifestFile),value));inside(resolved);return resolved;
  };
  assert.equal(manifest.version,1);assert.equal(manifest.kind,'familycopilot.demo.edit');
  const captureFile=resolve(manifest.capture),source=path.dirname(captureFile);
  resolve(path.relative(path.dirname(manifestFile),path.join(source,'familycopilot-chat-preview.mp4')));
  const capture=chatInputs(source,captureFile);
  assert.equal(hash(captureFile),manifest.captureSha256);
  const intro=resolve(manifest.intro.file);assert.equal(hash(intro),manifest.intro.sha256);
  const introDuration=manifest.intro.duration,introCue=manifest.intro.cue,introText=manifest.intro.text;
  assert(Number.isFinite(introDuration) && introDuration>0 && introDuration<=60);
  assert(introCue && Number.isFinite(introCue.start) && Number.isFinite(introCue.seconds));
  assert(introCue.start>=0 && introCue.seconds>0 && introCue.start+introCue.seconds<=introDuration,
    'Intro narration cue must fit inside the intro duration');
  const narration=manifest.narration;
  assert(Array.isArray(narration) && narration.length===capture.timeline.length);
  for(const text of [introText,...narration])validateCaption(text);
  assert(Array.isArray(manifest.voices) && manifest.voices.length===narration.length);
  const audio=manifest.voices.map((reference,index)=>{
    const directory=resolve(reference.directory);
    const voiceJSON=name=>read(resolve(path.relative(path.dirname(manifestFile),path.join(directory,name))));
    const script=voiceJSON('script.json'),speech=voiceJSON('speech-verification.json');
    assert.equal(speech.voice,'en-US-JennyNeural','Reused voice must be en-US-JennyNeural');
    assert.equal(speech.style,'friendly','Reused speech style must be friendly');
    assert.equal(speech.rate,'-3%','Reused speech rate must be -3%');
    assert(Number.isInteger(reference.index) && reference.index>=0);
    assert.equal(script.narration[reference.index],narration[index],'Narration changed: new explicitly approved audio required');
    const item=voiceJSON('audio.json')[reference.index];assert(item);
    assert.match(item.file,/^[\w-]+\.wav$/);
    const audioFile=resolve(path.relative(path.dirname(manifestFile),path.join(directory,item.file)));
    assert.equal(hash(audioFile),item.sha256);
    assert.equal(wavInfo(fs.readFileSync(audioFile)).seconds,item.seconds,'WAV duration differs from audio metadata');
    return {...item,file:audioFile,speechKey:speechKey(narration[index]),reusedFrom:{directory,index:reference.index}};
  });
  assert(typeof manifest.output==='string' && manifest.output.length>0);
  const requested=path.resolve(path.dirname(manifestFile),manifest.output);
  const output=path.join(fs.realpathSync(path.dirname(requested)),path.basename(requested));inside(output);
  assert(!fs.existsSync(output),'Output already exists; choose a new attempt directory');
  const plan=chatPlan(capture.timeline,audio,narration,introDuration);
  for(const [index,scene] of plan.scenes.entries())assert(scene.sourceEnd<=capture.durationSeconds,
    `Scene ${index+1} ends beyond the recorded source duration`);
  plan.cues=[{...introCue,text:introText},...plan.scenes.map(scene=>({start:scene.start+scene.delay,seconds:scene.seconds,text:scene.text}))];
  plan.captions=captionTimeline(plan.cues,plan.duration);
  return {source,captureFile,intro,introDuration,introCue,introText,narration,output,audio,
    saved:{capture:hash(captureFile),raw:hash(path.join(source,capture.raw)),intro:hash(intro)},
    manifestFile,manifestSha256:hash(manifestFile),plan};
}
function inputs(){
  if(chatMode){
    return chatInputs(source,captureFile);
  }
  const capture=read(path.join(source,'capture.json'));
  assert(capture.savedViewOnly && capture.calendarProviderRequests===0 && !capture.syntheticCalendars && !capture.urgent && capture.childNamesMasked);
  assert(/^[\w@.-]+\.webm$/.test(capture.raw));
  return capture;
}
async function synthesize(){
  const capture=inputs();
  fs.mkdirSync(output,{mode:0o700}); // One-shot marker, no retries or overwrite.
  write('source-hashes.json',{capture:hash(captureFile),raw:hash(path.join(source,capture.raw)),intro:hash(intro)});
  write('script.json',{narration,introText});
  assert(narration.length<=(chatMode?6:2) && narration.join('').length<1500);
  let key='',requests=0,stage='credential';
  try{
    const r=spawnSync('az',['cognitiveservices','account','keys','list','--subscription','609bbde3-d152-4d7d-a12b-005e38ac4f27','--resource-group','ReceiptModeling','--name','hackathon-VDI-taipei-tts','--query','key1','-o','tsv','--only-show-errors'],{timeout:30000,maxBuffer:16384,stdio:['ignore','pipe','pipe']});
    if(r.status!==0){r.stdout?.fill(0);r.stderr?.fill(0);throw Error();}
    key=r.stdout.toString('utf8').trim();r.stdout.fill(0);r.stderr?.fill(0);
    assert(key.length>0 && key.length<512 && !/[\r\n]/.test(key));
    const audio=[];
    for(const [i,text]of narration.entries()){
      stage=`voice_${i+1}`;
      const body=`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US"><voice name="en-US-JennyNeural"><mstts:express-as style="friendly"><prosody rate="-3%">${escapeXML(text)}</prosody></mstts:express-as></voice></speak>`;
      assert(body.length<1000);requests++;
      const response=await fetch('https://eastus.tts.speech.microsoft.com/cognitiveservices/v1',{method:'POST',redirect:'error',signal:AbortSignal.timeout(60000),headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'riff-48khz-16bit-mono-pcm'},body});
      if(response.status!==200){stage+=`_http_${response.status}`;await response.body?.cancel();throw Error();}
      let bytes=0;const parts=[];
      for await(const part of response.body){bytes+=part.length;assert(bytes<=12*1024*1024);parts.push(part);}
      const buffer=Buffer.concat(parts),info=wavInfo(buffer),file=`voice-${i+1}.wav`;
      assert(info.seconds>2 && info.seconds<25);
      fs.writeFileSync(path.join(output,file),buffer,{flag:'wx',mode:0o600});
      audio.push({file,...info,sha256:hash(path.join(output,file)),speechKey:speechKey(text)});
    }
    write('audio.json',audio);write('speech-verification.json',{voice:'en-US-JennyNeural',style:'friendly',rate:'-3%',requests,privateCalendarContentSent:false,resourceModified:false});
    console.log(JSON.stringify({status:'voices_complete',requests,seconds:audio.map(a=>a.seconds)}));
  }catch{console.error(JSON.stringify({status:'voices_failed',stage,requests,automaticRetry:false}));process.exitCode=1;}finally{key='';}
}
function render(){
  const c=inputs(),audio=read(path.join(output,'audio.json')),script=read(path.join(output,'script.json')),hashes=read(path.join(output,'source-hashes.json'));
  const verify=()=>{assert.equal(hash(path.join(source,'capture.json')),hashes.capture);assert.equal(hash(path.join(source,c.raw)),hashes.raw);assert.equal(hash(intro),hashes.intro);};
  verify();assert.equal(audio.length,2);assert.deepEqual(script,{narration,introText});
  for(const a of audio)assert.equal(hash(path.join(output,a.file)),a.sha256);
  const tools=process.env.FAMILYCOPILOT_DEMO_TOOLS;assert(tools && path.isAbsolute(tools));
  const ffmpeg=require(path.join(tools,'node_modules/ffmpeg-static'));
  const run=args=>{const r=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-n',...args],{cwd:output,encoding:'utf8',timeout:300000,maxBuffer:32768});if(r.status!==0)throw Error((r.stderr||'FFmpeg failed').slice(-2000));};
  const introDuration=15.2,first=15.65,second=first+audio[0].seconds+1.0;
  const calendarDuration=Math.ceil(Math.max(c.captureEnd-c.captureStart,second-introDuration+audio[1].seconds+1.2)*25)/25;
  const duration=introDuration+calendarDuration;
  const cues=[{start:.35,seconds:12.992208333333334,text:introText},{start:first,seconds:audio[0].seconds,text:narration[0]},{start:second,seconds:audio[1].seconds,text:narration[1]}];
  let ass='[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,DejaVu Sans,30,&H00FFFFFF,&H00FFFFFF,&H002A2E22,&H002A2E22,0,0,0,0,100,100,0,0,3,12,0,2,65,65,28,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
  let srt='',n=0;
  for(const cue of cues){const parts=chunks(cue.text),total=parts.reduce((a,p)=>a+p.length,0);let elapsed=0;for(const part of parts){const start=cue.start+cue.seconds*elapsed/total;elapsed+=part.length;const end=cue.start+cue.seconds*elapsed/total;ass+=`Dialogue: 0,${stamp(start,true)},${stamp(end,true)},Caption,,0,0,0,,${part}\n`;srt+=`${++n}\n${stamp(start)} --> ${stamp(end)}\n${part}\n\n`;}}
  fs.writeFileSync(path.join(output,'captions.ass'),ass,{flag:'wx'});fs.writeFileSync(path.join(output,'familycopilot-calendar.en.srt'),srt,{flag:'wx'});
  const filters=[
    '[0:v]fps=25,setsar=1,settb=AVTB,setpts=PTS-STARTPTS[v0]',
    `[1:v]trim=start=${c.captureStart}:end=${c.captureEnd},setpts=PTS-STARTPTS,fps=25,scale=1706:960,pad=1920:1080:107:0:color=0xfbf8f3,tpad=stop_mode=clone:stop_duration=${calendarDuration},trim=duration=${calendarDuration},setsar=1,settb=AVTB[v1]`,
    `[v0][v1]concat=n=2:v=1:a=0,ass=captions.ass,fade=t=out:st=${duration-.6}:d=0.6[v]`,
    '[0:a]aresample=48000,asetpts=PTS-STARTPTS[a0]',
    `[2:a]adelay=${Math.round(first*1000)}:all=1[a1]`,
    `[3:a]adelay=${Math.round(second*1000)}:all=1[a2]`,
    '[a0][a1][a2]amix=inputs=3:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]'
  ];
  run(['-i',intro,'-i',path.join(source,c.raw),...audio.flatMap(a=>['-i',a.file]),'-filter_complex',filters.join(';'),'-map','[v]','-map','[a]','-t',String(duration),'-r','25','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-metadata:s:a:0','language=eng','-movflags','+faststart','familycopilot-real-calendar.mp4']);
  run(['-i','familycopilot-real-calendar.mp4','-f','null','-']);verify();
  for(const [name,time]of [['intro',7],['loaded',18],['calendar',26],['later',35]])run(['-ss',String(time),'-i','familycopilot-real-calendar.mp4','-frames:v','1',`review-${name}.png`]);
  write('verification.json',{duration,decodePassed:true,realSavedCalendar:true,calendarProviderRequests:0,childNamesMasked:true,sourceHashesMatched:true,subtitleTiming:'Approximate within each clip, not word-aligned',...read(path.join(output,'speech-verification.json'))});
  console.log(JSON.stringify({output:path.relative(root,output),duration,decodePassed:true}));
}
function chatPlan(timeline,audio,texts=chatNarration,introDuration=15.2){
  assert(Array.isArray(timeline) && Array.isArray(audio) && Array.isArray(texts),'Timeline, audio and captions must be arrays');
  assert(timeline.length>0 && timeline.length<=12);assert.equal(audio.length,timeline.length);assert.equal(texts.length,timeline.length);
  assert(Number.isFinite(introDuration) && introDuration>0 && introDuration<=60,'Intro duration must be a finite number between 0 and 60 seconds');
  let cursor=introDuration;
  const scenes=Array.from(timeline,(scene,index)=>{
    assert(scene && Number.isFinite(scene.start) && Number.isFinite(scene.end) && scene.start>=0 && scene.end>scene.start,
      'Source scene must have finite nonnegative start and later end');
    if(index)assert(scene.start>=timeline[index-1].end,'Source scenes overlap or run backwards');
    assert(audio[index] && Number.isFinite(audio[index].seconds) && audio[index].seconds>2 && audio[index].seconds<25,
      'Audio duration must be a finite number between 2 and 25 seconds');
    validateCaption(texts[index]);
    const delay=index===2||index===5?1.0:0.25;
    const duration=Math.ceil(Math.max(scene.end-scene.start,delay+audio[index].seconds+0.6)*25)/25;
    const result={sourceStart:scene.start,sourceEnd:scene.end,start:cursor,duration,delay,text:texts[index],seconds:audio[index].seconds};
    cursor+=duration;return result;
  });
  return {scenes,duration:cursor};
}
function captionTimeline(cues,duration){
  assert(Array.isArray(cues) && cues.length>0,'Caption cues must be a nonempty array');
  assert(Number.isFinite(duration) && duration>0,'Caption track duration must be finite and positive');
  const captions=[];
  let previousEnd=0;
  for(const [index,cue] of cues.entries()){
    assert(cue && Number.isFinite(cue.start) && Number.isFinite(cue.seconds) && cue.start>=0 && cue.seconds>0,
      `Caption cue ${index+1} has invalid timing`);
    const cueEnd=cue.start+cue.seconds;
    assert(cue.start>=previousEnd && cueEnd<=duration,`Caption cue ${index+1} overlaps or exceeds the video duration`);
    validateCaption(cue.text);
    const parts=chunks(cue.text),total=parts.reduce((sum,text)=>sum+text.length,0);
    let elapsed=0;
    for(const text of parts){
      const startTick=Math.round((cue.start+cue.seconds*elapsed/total)*100);
      elapsed+=text.length;
      const endTick=Math.round((cue.start+cue.seconds*elapsed/total)*100);
      assert(Number.isSafeInteger(startTick) && Number.isSafeInteger(endTick) && endTick>startTick,
        `Caption cue ${index+1} collapses at ASS timestamp precision`);
      assert(endTick/100<=duration,`Caption cue ${index+1} rounds beyond the video duration`);
      captions.push({start:startTick/100,end:endTick/100,text});
    }
    previousEnd=cueEnd;
  }
  return captions;
}
function loadingPlan(duration,timeline,insertions){
  assert(Number.isFinite(duration) && duration>0);
  assert(Array.isArray(insertions) && insertions.length>0 && insertions.length<=4);
  let previous=0,offset=0;
  const waits=insertions.map(({at,seconds})=>{
    assert(Number.isFinite(at) && at>previous && at<duration,'Loading cuts must be ordered inside the source');
    assert(Number.isFinite(seconds) && seconds>=0.5 && seconds<=5,'Loading duration must be bounded');
    assert(Math.abs(at*25-Math.round(at*25))<1e-6 && Math.abs(seconds*25-Math.round(seconds*25))<1e-6,'Loading cuts must align to video frames');
    const wait={at,seconds,start:at+offset,end:at+offset+seconds};
    previous=at;offset+=seconds;return wait;
  });
  const cues=[];
  for(const scene of timeline){
    validateCaption(scene.text);
    assert(Number.isFinite(scene.start) && Number.isFinite(scene.end) && scene.start>=0 && scene.end>scene.start && scene.end<=duration);
    const boundaries=[scene.start,...waits.filter(wait=>wait.at>scene.start && wait.at<scene.end).map(wait=>wait.at),scene.end];
    for(let index=0;index<boundaries.length-1;index++){
      const start=boundaries[index],end=boundaries[index+1];
      const shift=waits.filter(wait=>wait.at<=start).reduce((sum,wait)=>sum+wait.seconds,0);
      if(Math.round((end+shift)*100)<=Math.round((start+shift)*100))continue;
      cues.push({start:start+shift,seconds:end-start,text:scene.text});
    }
  }
  for(const wait of waits)cues.push({start:wait.start,seconds:wait.seconds,text:'Loading (demo simulation). No live query.'});
  cues.sort((left,right)=>left.start-right.start);
  return {duration:duration+offset,waits,captions:captionTimeline(cues,duration+offset)};
}
function renderLoadingPreview(file){
  const base=fs.realpathSync(path.join(root,'browser-artifacts/demo'));
  const resolve=value=>{
    const target=fs.realpathSync(path.resolve(path.dirname(file),value));
    assert(target.startsWith(base+path.sep),'Loading edit inputs must stay in the private demo directory');
    return target;
  };
  file=resolve(file);
  const editHash=hash(file),edit=read(file);
  assert.equal(edit.version,1);assert.equal(edit.kind,'familycopilot.demo.loading-edit');
  const deliveryFile=resolve(edit.delivery),delivery=read(deliveryFile);
  assert.equal(hash(deliveryFile),edit.deliverySha256);
  assert.equal(delivery.audio,'none_intentional','This edit supports silent previews only');
  assert.equal(delivery.width,1920);assert.equal(delivery.height,1080);assert.equal(delivery.framesPerSecond,25);
  const relative=value=>path.relative(path.dirname(file),path.resolve(path.dirname(deliveryFile),value));
  const video=resolve(relative(delivery.video)),captureFile=resolve(relative(delivery.captureManifest)),capture=read(captureFile);
  const verify=()=>{
    assert.equal(hash(file),editHash);assert.equal(hash(deliveryFile),edit.deliverySha256);
    assert.equal(hash(video),delivery.videoSha256);assert.equal(hash(captureFile),delivery.captureManifestSha256);
  };
  verify();
  const plan=loadingPlan(delivery.durationSeconds,capture.timeline,edit.insertions);
  const tools=process.env.FAMILYCOPILOT_DEMO_TOOLS;assert(tools && path.isAbsolute(tools));
  const ffmpeg=require(path.join(tools,'node_modules/ffmpeg-static'));
  const directory=fs.mkdtempSync(path.join(base,'loading-edit-'));
  const save=(name,content)=>fs.writeFileSync(path.join(directory,name),content,{flag:'wx',mode:0o600});
  save('edit-input.json',JSON.stringify({file,sha256:editHash,edit},null,2)+'\n');
  let ass='[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 0\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,DejaVu Sans,30,&H00FFFFFF,&H00FFFFFF,&H0025291F,&H0025291F,0,0,0,0,100,100,0,0,1,0,0,2,85,85,32,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
  const dialogue=(start,end,text)=>`Dialogue: 0,${stamp(start,true)},${stamp(end,true)},Caption,,0,0,0,,${text}\n`;
  let srt='';
  for(const [index,cue] of plan.captions.entries()){
    srt+=`${index+1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n\n`;
    if(!plan.waits.some(wait=>cue.start>=wait.start && cue.end<=wait.end))ass+=dialogue(cue.start,cue.end,cue.text);
  }
  for(const wait of plan.waits){
    ass+=dialogue(wait.start,wait.end,'{\\an5\\pos(960,1044)\\fs22}Demo simulation. No live query.');
    for(let step=0;step<Math.ceil(wait.seconds/0.32);step++){
      const start=wait.start+step*0.32,end=Math.min(wait.end,start+0.32);
      ass+=dialogue(start,end,`{\\an4\\pos(865,990)\\fs34}Loading${'.'.repeat(step%3+1)}`);
    }
  }
  save('captions.ass',ass);save('familycopilot-loading.en.srt',srt);
  const cuts=[0,...plan.waits.map(wait=>wait.at),delivery.durationSeconds];
  const filters=[`[0:v]split=${cuts.length-1}${cuts.slice(1).map((_,index)=>`[s${index}]`).join('')}`];
  for(let index=0;index<cuts.length-1;index++){
    const padding=plan.waits[index]?.seconds||0;
    filters.push(`[s${index}]trim=start=${cuts[index]}:end=${cuts[index+1]},setpts=PTS-STARTPTS,fps=25,crop=1920:960:0:0,pad=1920:1080:0:0:color=0x25291f,tpad=stop_mode=clone:stop_duration=${padding},trim=duration=${cuts[index+1]-cuts[index]+padding},setsar=1,settb=AVTB[v${index}]`);
  }
  filters.push(`${cuts.slice(1).map((_,index)=>`[v${index}]`).join('')}concat=n=${cuts.length-1}:v=1:a=0,ass=captions.ass[v]`);
  const run=args=>{
    const result=spawnSync(ffmpeg,['-nostdin','-hide_banner','-n',...args],{cwd:directory,encoding:'utf8',timeout:300000,maxBuffer:1048576});
    assert.equal(result.status,0,(result.stderr||'Loading render failed').slice(-2000));return result.stderr;
  };
  const target='familycopilot-loading-preview.mp4';
  run(['-loglevel','error','-i',video,'-filter_complex',filters.join(';'),'-map','[v]','-an','-t',String(plan.duration),'-r','25','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',target]);
  const decoded=run(['-i',target,'-f','null','-']);
  assert(!/Stream #.*Audio:/.test(decoded));
  const match=decoded.match(/Duration: (\d+):(\d+):([\d.]+)/);assert(match,'Missing decoded duration');
  const duration=Number(match[1])*3600+Number(match[2])*60+Number(match[3]);
  assert(Math.abs(duration-plan.duration)<0.04,'Rendered duration differs from the loading plan');
  const frames=[];
  for(const [index,wait] of plan.waits.entries()){
    for(const [name,time] of [['before',wait.start-0.08],['loading-a',wait.start+0.16],['loading-b',wait.start+0.8],['after',wait.end+0.4]]){
      const frame=`review-${index+1}-${name}.png`;frames.push(frame);
      run(['-loglevel','error','-ss',String(time),'-i',target,'-frames:v','1',frame]);
    }
  }
  run(['-loglevel','error','-ss',String(plan.duration-2),'-i',target,'-frames:v','1','review-ending.png']);
  frames.push('review-ending.png');verify();
  save('manifest.json',JSON.stringify({version:1,kind:'familycopilot.demo.loading-delivery',video:target,videoSha256:hash(path.join(directory,target)),
    captionsFile:'familycopilot-loading.en.srt',captionsSha256:hash(path.join(directory,'familycopilot-loading.en.srt')),
    sourceDelivery:deliveryFile,sourceDeliverySha256:edit.deliverySha256,sourceVideoSha256:delivery.videoSha256,
    editSha256:editHash,...plan,width:1920,height:1080,framesPerSecond:25,audio:'none_intentional',fullDecodePassed:true,sourceHashesUnchanged:true,
    captionBoundsPassed:true,reviewFrames:frames,visualReview:'pending',humanContinuousReview:'pending',
    simulatedLoading:true,editorialFreezeFrames:true,productBehaviorChanged:false,newRecording:false,newSpeechRequests:0,networkRequests:0,
    limitations:delivery.limitations},null,2)+'\n');
  console.log(JSON.stringify({output:path.relative(root,directory),duration,fullDecodePassed:true,simulatedLoading:true}));
}
function trimPreviewPlan(capture,firstScene){
  assert(Number.isInteger(firstScene) && firstScene>=1 && firstScene<=capture.timeline.length,'Invalid first scene');
  assert(Number.isFinite(capture.durationSeconds) && capture.durationSeconds>0);
  const sourceStart=Math.floor(capture.timeline[firstScene-1].start*25)/25;
  assert(sourceStart>=0 && sourceStart<capture.durationSeconds);
  const duration=Math.round((capture.durationSeconds-sourceStart)*25)/25;
  const timeline=capture.timeline.slice(firstScene-1).map(scene=>({text:scene.text,start:scene.start-sourceStart,end:scene.end-sourceStart}));
  const captions=captionTimeline(timeline.map(scene=>({start:scene.start,seconds:scene.end-scene.start,text:scene.text})),duration);
  return {sourceStart,duration,timeline,captions};
}
function trimSilentPreview(file,expectedHash,firstScene){
  const base=fs.realpathSync(path.join(root,'browser-artifacts/demo'));
  const inside=target=>{const resolved=fs.realpathSync(target);assert(resolved.startsWith(base+path.sep));return resolved;};
  file=inside(file);assert.match(expectedHash,/^[a-f0-9]{64}$/);assert.equal(hash(file),expectedHash);
  const capture=read(file),sourceDirectory=path.dirname(file);
  assert(capture.syntheticOnly && capture.fullDecodePassed && capture.forbiddenRequests===0 && capture.browserErrors===0);
  assert.equal(capture.finalVerification?.audio,'none_intentional');
  assert.equal(capture.width,1920);assert.equal(capture.height,1080);
  const video=inside(path.resolve(sourceDirectory,capture.videoFile));
  const assFile=inside(path.join(sourceDirectory,'captions.ass')),assHash=hash(assFile);
  const verify=()=>{assert.equal(hash(file),expectedHash);assert.equal(hash(video),capture.videoSha256);assert.equal(hash(assFile),assHash);};
  verify();
  const plan=trimPreviewPlan(capture,firstScene);
  plan.timeline[0].text='What could we do together in October? This walkthrough uses demo data.';
  plan.captions=captionTimeline(plan.timeline.map(scene=>({start:scene.start,seconds:scene.end-scene.start,text:scene.text})),plan.duration);
  const tools=process.env.FAMILYCOPILOT_DEMO_TOOLS;assert(tools && path.isAbsolute(tools));
  const ffmpeg=require(path.join(tools,'node_modules/ffmpeg-static'));
  const directory=fs.mkdtempSync(path.join(base,'conversation-cut-'));
  const save=(name,content)=>fs.writeFileSync(path.join(directory,name),content,{flag:'wx',mode:0o600});
  const header=fs.readFileSync(assFile,'utf8').split(/^Dialogue:/m)[0];assert(header.includes('[Events]'));
  save('captions.ass',header+plan.captions.map(cue=>`Dialogue: 0,${stamp(cue.start,true)},${stamp(cue.end,true)},Caption,,0,0,0,,${cue.text}\n`).join(''));
  const captionsFile='familycopilot-conversation.en.srt',videoFile='familycopilot-conversation.mp4';
  save(captionsFile,plan.captions.map((cue,index)=>`${index+1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n`).join('\n'));
  const run=args=>{const result=spawnSync(ffmpeg,['-nostdin','-hide_banner','-n',...args],{cwd:directory,encoding:'utf8',timeout:300000,maxBuffer:1048576});assert.equal(result.status,0,(result.stderr||'Trim failed').slice(-2000));return result.stderr;};
  run(['-loglevel','error','-ss',String(plan.sourceStart),'-i',video,'-vf','crop=1920:960:0:0,pad=1920:1080:0:0:color=0x25291f,ass=captions.ass',
    '-t',String(plan.duration),'-an','-r','25','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',videoFile]);
  const decoded=run(['-i',videoFile,'-f','null','-']);assert(!/Stream #.*Audio:/.test(decoded));
  const match=decoded.match(/Duration: (\d+):(\d+):([\d.]+)/);assert(match);
  assert(Math.abs(Number(match[1])*3600+Number(match[2])*60+Number(match[3])-plan.duration)<0.04);
  const reviewTimes=[['opening',0.8],['loading',16-plan.sourceStart],['scroll',17.8-plan.sourceStart],['ending',plan.duration-2]];
  for(const [name,time] of reviewTimes)run(['-loglevel','error','-ss',String(time),'-i',videoFile,'-frames:v','1',`review-${name}.png`]);
  verify();
  save('manifest.json',JSON.stringify({version:1,kind:'familycopilot.demo.conversation-cut',videoFile,captionsFile,
    videoSha256:hash(path.join(directory,videoFile)),captionsSha256:hash(path.join(directory,captionsFile)),sourceManifest:file,sourceManifestSha256:expectedHash,
    sourceVideoSha256:capture.videoSha256,sourceAssSha256:assHash,firstScene,...plan,width:1920,height:1080,framesPerSecond:25,audio:'none_intentional',
    fullDecodePassed:true,captionBoundsPassed:true,sourceHashesUnchanged:true,removedPreferenceConfiguration:true,
    simulatedResponseTiming:capture.simulatedResponseTiming,continuousSourceSegment:true,newRecording:false,newSpeechRequests:0,
    visualReview:'pending',humanContinuousReview:'pending',limitations:capture.limitations,
    framingNote:'Existing preference summary may remain visible while typing; no configuration editor or Cancel sequence is included. This edit does not claim new conversational preference editing.'},null,2)+'\n');
  console.log(JSON.stringify({output:path.relative(root,directory),duration:plan.duration,removedSeconds:plan.sourceStart,fullDecodePassed:true}));
}
function chapterPreviewPlan(capture,beforeScene,seconds=3){
  assert(Number.isInteger(beforeScene) && beforeScene>1 && beforeScene<=capture.timeline.length,'Invalid chapter scene');
  assert(Number.isFinite(seconds) && seconds>=2 && seconds<=5 && Math.abs(seconds*25-Math.round(seconds*25))<1e-6);
  const at=Math.floor(capture.timeline[beforeScene-1].start*25)/25;
  assert(Number.isFinite(capture.duration) && at>0 && at<capture.duration);
  const chapter={start:at,end:at+seconds,text:'Another user story: Who can attend the school meeting?'};
  const timeline=capture.timeline.map((scene,index)=>index<beforeScene-1?
    {...scene,end:Math.min(scene.end,at)}:
    {...scene,start:Math.max(scene.start,at)+seconds,end:scene.end+seconds});
  timeline.splice(beforeScene-1,0,chapter);
  const duration=Math.round((capture.duration+seconds)*25)/25;
  const captions=captionTimeline(timeline.map(scene=>({start:scene.start,seconds:scene.end-scene.start,text:scene.text})),duration);
  return {at,seconds,chapter,timeline,captions,duration};
}
function chapterFrame(capture){
  assert(capture.width===1920 && capture.height===1080 || capture.width===1440 && capture.height===1020,'Unsupported chapter frame');
  return {width:capture.width,height:capture.height,contentHeight:capture.height-120};
}
function renderSchoolChapter(file,expectedHash,beforeScene){
  const base=fs.realpathSync(path.join(root,'browser-artifacts/demo'));
  const inside=target=>{const resolved=fs.realpathSync(target);assert(resolved.startsWith(base+path.sep));return resolved;};
  file=inside(file);assert.match(expectedHash,/^[a-f0-9]{64}$/);assert.equal(hash(file),expectedHash);
  const input=read(file),sourceDirectory=path.dirname(file);
  const directCapture=input.syntheticOnly===true;
  if(directCapture){
    assert(input.fullDecodePassed && input.forbiddenRequests===0 && input.browserErrors===0 && input.snapshot?.sha256);
    assert.match(input.narration,/^none:/);
  }else{
    assert.equal(input.kind,'familycopilot.demo.conversation-cut');assert(input.fullDecodePassed && input.sourceHashesUnchanged);
    assert.equal(input.audio,'none_intentional');assert.equal(input.framesPerSecond,25);
  }
  const capture=directCapture?{...input,duration:input.durationSeconds,videoFile:'familycopilot-chat-preview.mp4',captionsFile:'familycopilot-chat.en.srt',limitations:input.snapshot.scenario.limitations}:input;
  const frame=chapterFrame(capture);
  assert.match(capture.timeline[beforeScene-1]?.text||'',/school meeting/i);
  const video=inside(path.resolve(sourceDirectory,capture.videoFile));
  const assFile=inside(path.join(sourceDirectory,'captions.ass')),assHash=hash(assFile);
  const subtitles=inside(path.resolve(sourceDirectory,capture.captionsFile));
  const subtitleHash=directCapture?hash(subtitles):capture.captionsSha256;
  const verify=()=>{assert.equal(hash(file),expectedHash);assert.equal(hash(video),capture.videoSha256);assert.equal(hash(assFile),assHash);assert.equal(hash(subtitles),subtitleHash);};
  verify();const plan=chapterPreviewPlan(capture,beforeScene);
  const tools=process.env.FAMILYCOPILOT_DEMO_TOOLS;assert(tools && path.isAbsolute(tools));
  const ffmpeg=require(path.join(tools,'node_modules/ffmpeg-static'));
  const directory=fs.mkdtempSync(path.join(base,'school-chapter-'));
  const save=(name,content)=>fs.writeFileSync(path.join(directory,name),content,{flag:'wx',mode:0o600});
  const header=fs.readFileSync(assFile,'utf8').split(/^Dialogue:/m)[0];assert(header.includes('[Events]'));
  let ass=header+plan.captions.filter(cue=>cue.start<plan.chapter.start || cue.start>=plan.chapter.end)
    .map(cue=>`Dialogue: 0,${stamp(cue.start,true)},${stamp(cue.end,true)},Caption,,0,0,0,,${cue.text}\n`).join('');
  for(const [vertical,size,text,color] of [[350,32,'ANOTHER USER STORY','&H00705B16&'],[480,64,'Who can attend the','&H00312820&'],[560,64,'school meeting?','&H00312820&'],[735,26,'Family Copilot | Demo data','&H00645A50&']]){
    ass+=`Dialogue: 1,${stamp(plan.chapter.start,true)},${stamp(plan.chapter.end,true)},Caption,,0,0,0,,{\\an5\\pos(${frame.width/2},${Math.round(vertical*frame.height/1080)})\\fs${Math.round(size*frame.width/1920)}\\c${color}\\bord0\\shad0\\fad(180,180)}${text}\n`;
  }
  save('captions.ass',ass);
  const captionsFile='familycopilot-two-stories.en.srt',videoFile='familycopilot-two-stories.mp4';
  save(captionsFile,plan.captions.map((cue,index)=>`${index+1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n`).join('\n'));
  const normalize=`setpts=PTS-STARTPTS,fps=25,crop=${frame.width}:${frame.contentHeight}:0:0,pad=${frame.width}:${frame.height}:0:0:color=0x25291f,setsar=1,settb=AVTB`;
  const filters=[`[0:v]split=2[before][after]`,`[before]trim=end=${plan.at},${normalize}[first]`,
    `[after]trim=start=${plan.at},${normalize}[last]`,
    `color=c=0xf4f6f2:s=${frame.width}x${frame.height}:r=25:d=${plan.seconds},drawbox=x=${frame.width/2-80}:y=${Math.round(280*frame.height/1080)}:w=160:h=6:color=0x165b70:t=fill,setsar=1,settb=AVTB[chapter]`,
    '[first][chapter][last]concat=n=3:v=1:a=0,ass=captions.ass[video]'];
  const run=args=>{const result=spawnSync(ffmpeg,['-nostdin','-hide_banner','-n',...args],{cwd:directory,encoding:'utf8',timeout:300000,maxBuffer:1048576});assert.equal(result.status,0,(result.stderr||'Chapter render failed').slice(-2000));return result.stderr;};
  run(['-loglevel','error','-i',video,'-filter_complex',filters.join(';'),'-map','[video]','-t',String(plan.duration),'-an','-r','25','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',videoFile]);
  const decoded=run(['-i',videoFile,'-f','null','-']);assert(!/Stream #.*Audio:/.test(decoded));assert.match(decoded,new RegExp(`Video: h264.*${frame.width}x${frame.height}`));
  const match=decoded.match(/Duration: (\d+):(\d+):([\d.]+)/);assert(match);
  assert(Math.abs(Number(match[1])*3600+Number(match[2])*60+Number(match[3])-plan.duration)<0.04);
  const reviewTimes=[['opening',0.8],['before',plan.at-0.2],['chapter',plan.at+1.5],['meeting',plan.chapter.end+3],['ending',plan.duration-2]];
  for(const [name,time] of reviewTimes)run(['-loglevel','error','-ss',String(time),'-i',videoFile,'-frames:v','1',`review-${name}.png`]);
  verify();
  save('manifest.json',JSON.stringify({version:1,kind:'familycopilot.demo.school-chapter',videoFile,captionsFile,
    videoSha256:hash(path.join(directory,videoFile)),captionsSha256:hash(path.join(directory,captionsFile)),sourceManifest:file,sourceManifestSha256:expectedHash,
    sourceVideoSha256:capture.videoSha256,sourceAssSha256:assHash,sourceCaptionsSha256:subtitleHash,sourceSnapshot:capture.snapshot||null,...plan,width:frame.width,height:frame.height,framesPerSecond:25,audio:'none_intentional',
    fullDecodePassed:true,captionBoundsPassed:true,sourceHashesUnchanged:true,editorialChapterInserted:true,continuousSourceSegment:false,
    sourceFramesRetained:true,newRecording:false,newSpeechRequests:0,networkRequests:0,productBehaviorChanged:false,
    simulatedResponseTiming:capture.simulatedResponseTiming,removedPreferenceConfiguration:capture.removedPreferenceConfiguration,
    reviewFrames:reviewTimes.map(([name])=>`review-${name}.png`),visualReview:'pending',humanContinuousReview:'pending',limitations:capture.limitations,framingNote:capture.framingNote},null,2)+'\n');
  console.log(JSON.stringify({output:path.relative(root,directory),duration:plan.duration,chapter:plan.chapter,fullDecodePassed:true}));
}
function renderChat(configuration){
  const settings=configuration || {source,captureFile,intro,output,narration,introText,introDuration:15.2,introCue:{start:0.35,seconds:12.992208333333334}};
  const {source:sourceDirectory,captureFile:capturePath,intro:introFile,output:outputDirectory,narration:texts,introText:openingText}=settings;
  const capture=chatInputs(sourceDirectory,capturePath),audio=settings.audio || read(path.join(outputDirectory,'audio.json'));
  const saved=settings.saved || read(path.join(outputDirectory,'source-hashes.json'));
  if(!configuration)assert.deepEqual(read(path.join(outputDirectory,'script.json')),{narration:texts,introText:openingText});
  const write=(name,data)=>fs.writeFileSync(path.join(outputDirectory,name),JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
  const verify=()=>{
    if(configuration)assert.equal(hash(settings.manifestFile),settings.manifestSha256);
    assert.equal(hash(capturePath),saved.capture);assert.equal(hash(path.join(sourceDirectory,capture.raw)),saved.raw);assert.equal(hash(introFile),saved.intro);
    for(const item of audio){const file=path.resolve(outputDirectory,item.file);assert.equal(hash(file),item.sha256);assert.equal(wavInfo(fs.readFileSync(file)).seconds,item.seconds);}
  };
  verify();
  const {scenes,duration}=settings.plan || chatPlan(capture.timeline,audio,texts,settings.introDuration);
  const cues=settings.plan?.cues || [{...settings.introCue,text:openingText},...scenes.map(scene=>({start:scene.start+scene.delay,seconds:scene.seconds,text:scene.text}))];
  const captions=settings.plan?.captions || captionTimeline(cues,duration);
  const tools=process.env.FAMILYCOPILOT_DEMO_TOOLS;assert(tools && path.isAbsolute(tools));
  const ffmpeg=require(path.join(tools,'node_modules/ffmpeg-static'));
  if(configuration){
    fs.mkdirSync(outputDirectory,{mode:0o700});
    write('edit-input.json',{manifest:settings.manifestFile,sha256:settings.manifestSha256});
  }
  let ass='[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 0\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,DejaVu Sans,30,&H00FFFFFF,&H00FFFFFF,&H0025291F,&H0025291F,0,0,0,0,100,100,0,0,3,8,0,2,85,85,32,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
  let srt='',number=0;
  for(const {start,end,text} of captions){
    ass+=`Dialogue: 0,${stamp(start,true)},${stamp(end,true)},Caption,,0,0,0,,${text}\n`;
    srt+=`${++number}\n${stamp(start)} --> ${stamp(end)}\n${text}\n\n`;
  }
  fs.writeFileSync(path.join(outputDirectory,'captions.ass'),ass,{flag:'wx'});
  fs.writeFileSync(path.join(outputDirectory,'familycopilot-chat.en.srt'),srt,{flag:'wx'});
  const filters=[`[0:v]trim=duration=${settings.introDuration},fps=25,setsar=1,settb=AVTB,setpts=PTS-STARTPTS[v0]`,
    `[1:v]split=${scenes.length}${scenes.map((scene,index)=>`[s${index}]`).join('')}`];
  scenes.forEach((scene,index)=>filters.push(`[s${index}]trim=start=${scene.sourceStart}:end=${scene.sourceEnd},setpts=PTS-STARTPTS,fps=25,crop=1920:960:0:0,pad=1920:1080:0:0:color=0x25291f,tpad=stop_mode=clone:stop_duration=${scene.duration},trim=duration=${scene.duration},setsar=1,settb=AVTB[v${index+1}]`));
  filters.push(`[v0]${scenes.map((scene,index)=>`[v${index+1}]`).join('')}concat=n=${scenes.length+1}:v=1:a=0,ass=captions.ass,fade=t=out:st=${duration-0.6}:d=0.6[v]`);
  filters.push(`[0:a]atrim=duration=${settings.introDuration},aresample=48000,asetpts=PTS-STARTPTS[a0]`);
  scenes.forEach((scene,index)=>filters.push(`[${index+2}:a]adelay=${Math.round((scene.start+scene.delay)*1000)}:all=1[a${index+1}]`));
  filters.push(`[a0]${scenes.map((scene,index)=>`[a${index+1}]`).join('')}amix=inputs=${scenes.length+1}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]`);
  const run=args=>{const result=spawnSync(ffmpeg,['-nostdin','-hide_banner','-n',...args],{cwd:outputDirectory,encoding:'utf8',timeout:300000,maxBuffer:1048576});assert.equal(result.status,0,(result.stderr||'Render failed').slice(-2000));return result.stderr;};
  const target='familycopilot-chat-jenny.mp4';
  run(['-loglevel','error','-i',introFile,'-i',path.join(sourceDirectory,capture.raw),...audio.flatMap(item=>['-i',item.file]),'-filter_complex',filters.join(';'),'-map','[v]','-map','[a]','-t',String(duration),'-r','25','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-metadata:s:a:0','language=eng','-movflags','+faststart',target]);
  const analysis=run(['-i',target,'-af','volumedetect','-f','null','-']);
  const mean=Number(analysis.match(/mean_volume: (-?[\d.]+) dB/)?.[1]),peak=Number(analysis.match(/max_volume: (-?[\d.]+) dB/)?.[1]);
  assert(Number.isFinite(mean)&&mean>-50);assert(Number.isFinite(peak)&&peak<0);
  verify();
  for(const [name,time]of [['intro',settings.introDuration/2],['handoff',scenes[0].start+1],['cards',(scenes[3]||scenes.at(-1)).start+1],['ending',duration-1]])run(['-loglevel','error','-ss',String(time),'-i',target,'-frames:v','1',`review-${name}.png`]);
  write('manifest.json',{duration,width:1920,height:1080,scenes,cues,captions,sourceHashes:saved,videoSha256:hash(path.join(outputDirectory,target)),decodePassed:true,audioMeanDb:mean,audioPeakDb:peak,
    speech:configuration?{requests:0,reusedClips:audio.map(item=>({sha256:item.sha256,speechKey:item.speechKey,...item.reusedFrom}))}:read(path.join(outputDirectory,'speech-verification.json')),
    editManifestSha256:settings.manifestSha256||null,snapshot:capture.snapshot||null,activityEvidence:capture.activityEvidence||'synthetic',
    introReused:true,syntheticChat:true,realTeamIncluded:capture.realTeamIncluded??null,newRecording:false,calendarRequests:0,publicSearches:0,
    subtitleTiming:'Approximate within each clip, not word-aligned',humanAudition:'pending',framingLimitation:configuration?'Requires visual review of this edit':'Activity scene retains first-cut source-detail framing.'});
  console.log(JSON.stringify({output:path.relative(root,outputDirectory),duration,decodePassed:true,audioMeanDb:mean,audioPeakDb:peak}));
}
if(require.main===module){
  if(process.argv[2]==='--school-chapter'){
    try{assert.equal(process.argv.length,8);assert.equal(process.argv[4],'--before-scene');assert.equal(process.argv[6],'--sha256');renderSchoolChapter(path.resolve(process.argv[3]),process.argv[7],Number(process.argv[5]));}
    catch(error){console.error(error.message);process.exitCode=1;}
  }else if(process.argv[2]==='--trim-chat-preview'){
    try{assert.equal(process.argv.length,8);assert.equal(process.argv[4],'--from-scene');assert.equal(process.argv[6],'--sha256');trimSilentPreview(path.resolve(process.argv[3]),process.argv[7],Number(process.argv[5]));}
    catch(error){console.error(error.message);process.exitCode=1;}
  }else if(process.argv[2]==='--render-loading-preview'){
    try{assert.equal(process.argv.length,4);renderLoadingPreview(path.resolve(process.argv[3]));}
    catch(error){console.error(error.message);process.exitCode=1;}
  }else if(['--plan-chat','--render-chat-manifest'].includes(process.argv[2])){
    try{
      assert.equal(process.argv.length,4);
      const configuration=loadChatEdit(path.resolve(process.argv[3]));
      if(process.argv[2]==='--plan-chat')console.log(JSON.stringify({output:configuration.output,...configuration.plan,newSpeechRequests:0,rendered:false},null,2));
      else renderChat(configuration);
    }catch(error){console.error(error.message);process.exitCode=1;}
  }else{
  assert.equal(process.argv.length,3);
  if(['--synthesize-approved','--synthesize-full-approved','--synthesize-chat-approved'].includes(process.argv[2]))synthesize().catch(()=>{console.error('Source or attempt marker invalid.');process.exitCode=1;});
  else if(['--render-offline','--render-full-offline','--render-chat-offline'].includes(process.argv[2])){
    try{if(chatMode)renderChat();else if(fullStory)require('./render-complete-demo').render({source,intro,output,narration,introText});else render();}catch(e){console.error(e.message);process.exitCode=1;}
  }else throw Error('Explicit synthesis or offline render required');
  }
}
module.exports={narration,transitionNarration,chatNarration,chatPlan,speechKey,loadChatEdit,captionTimeline,loadingPlan,trimPreviewPlan,chapterPreviewPlan,chapterFrame};