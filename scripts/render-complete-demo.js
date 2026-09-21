"use strict";
// Offline edit: real saved calendars + previously captured live public Activities.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto'),{spawnSync}=require('node:child_process');
const {stamp,chunks,wavInfo}=require('./finish-integrated-demo');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function plan(c,calendarAudio,activityStory,activityAudio){
  assert.equal(calendarAudio.length,2);assert.equal(activityStory.length,8);assert.equal(activityAudio.length,8);
  const calendarDuration=Math.ceil(Math.max(c.captureEnd-c.captureStart,calendarAudio[0].seconds+calendarAudio[1].seconds+1.2)*25)/25;
  const scenes=[{kind:'intro',start:0,duration:15.2},
    {kind:'calendar',start:15.2,duration:calendarDuration,sourceStart:c.captureStart,sourceEnd:c.captureEnd}];
  let cursor=15.2+calendarDuration;
  for(let i=3;i<8;i++){
    const s=activityStory[i];
    // First two seconds of original scene 4 still show the old sample calendar.
    // Only the verified Activities frame onward is included in this real edit.
    const sourceStart=i===3?43.5:i===7?3:s.start;
    const delay=i===4?6:0.15;
    const duration=Math.ceil(Math.max(s.end-sourceStart,delay+activityAudio[i].seconds+0.65)*25)/25;
    assert(s.end>sourceStart);
    scenes.push({kind:i===7?'official':'activities',index:i,start:cursor,duration,sourceStart,sourceEnd:s.end,delay,text:s.text,voiceSeconds:activityAudio[i].seconds});
    cursor+=duration;
  }
  return {scenes,duration:cursor,calendarVoiceStart:14.65,calendarSecondStart:15.2+calendarDuration-calendarAudio[1].seconds-0.45};
}
function render({source,intro,output,narration,introText}){
  const c=read(path.join(source,'capture.json')),audio=read(path.join(output,'audio.json')),script=read(path.join(output,'script.json'));
  assert(c.savedViewOnly && !c.syntheticCalendars && c.childNamesMasked && !c.urgent);
  assert.deepEqual(script,{narration,introText});
  const saved=read(path.join(output,'source-hashes.json'));
  assert.equal(hash(path.join(source,'capture.json')),saved.capture);assert.equal(hash(path.join(source,c.raw)),saved.raw);assert.equal(hash(intro),saved.intro);
  const activity=path.join(root,'browser-artifacts/demo/integrated-20260918'),voices=path.join(activity,'jenny-story');
  const proof=read(path.join(activity,'capture-verification.json')),raw=read(path.join(activity,'raw-files.json'));
  assert(proof.liveSearch===1 && proof.officialOpened);
  for(const name of Object.values(raw))assert(/^[\w@.-]+\.webm$/.test(name));
  // Recheck the original approved capture instead of re-querying the source.
  for(const [name,digest]of Object.entries(read(path.join(voices,'source-hashes.json'))))assert.equal(hash(path.join(activity,name)),digest);
  const activityStory=read(path.join(voices,'narration-plan.json')),activityAudio=read(path.join(voices,'audio.json'));
  const {scenes,duration,calendarVoiceStart,calendarSecondStart}=plan(c,audio,activityStory,activityAudio);
  const clipFiles=[...audio.map(a=>path.join(output,a.file)),...activityAudio.slice(3).map(a=>path.join(voices,a.file))];
  clipFiles.forEach((file,i)=>assert.equal(wavInfo(fs.readFileSync(file)).seconds,i<2?audio[i].seconds:activityAudio[i+1].seconds));
  audio.forEach(a=>assert.equal(hash(path.join(output,a.file)),a.sha256));
  const inputs=[intro,path.join(source,c.raw),path.join(activity,raw.app),path.join(activity,raw.official),...clipFiles];
  const inputHashes=Object.fromEntries(inputs.map(file=>[path.relative(root,file),hash(file)]));
  const write=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
  write('edit-input-hashes.json',inputHashes);write('edit-timeline.json',{scenes,duration,calendarVoiceStart,calendarSecondStart});
  const cues=[{start:0.35,seconds:12.992208333333334,text:introText},
    {start:calendarVoiceStart,seconds:audio[0].seconds,text:narration[0]},
    {start:calendarSecondStart,seconds:audio[1].seconds,text:narration[1]},
    ...scenes.slice(2).map(s=>({start:s.start+s.delay,seconds:s.voiceSeconds,text:s.text}))];
  assert(cues[1].start+cues[1].seconds<cues[2].start);
  // Keep the clean caption style used in the delivered calendar segment.
  let ass=fs.readFileSync(path.join(source,'finished/captions.ass'),'utf8').split('[Events]')[0]+'[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
  let srt='',number=0;
  for(const cue of cues){let elapsed=0;const parts=chunks(cue.text),total=parts.reduce((n,p)=>n+p.length,0);for(const text of parts){const start=cue.start+cue.seconds*elapsed/total;elapsed+=text.length;const end=cue.start+cue.seconds*elapsed/total;ass+=`Dialogue: 0,${stamp(start,true)},${stamp(end,true)},Caption,,0,0,0,,${text}\n`;srt+=`${++number}\n${stamp(start)} --> ${stamp(end)}\n${text}\n\n`;}}
  fs.writeFileSync(path.join(output,'captions.ass'),ass,{flag:'wx'});fs.writeFileSync(path.join(output,'familycopilot-complete.en.srt'),srt,{flag:'wx'});
  const filters=['[0:v]fps=25,setsar=1,settb=AVTB,setpts=PTS-STARTPTS[v0]','[2:v]split=4[s0][s1][s2][s3]'];
  scenes.slice(1).forEach((s,j)=>{
    const input=s.kind==='calendar'?'1:v':s.kind==='official'?'3:v':`s${j-1}`;
    const layout=s.kind==='calendar'?'scale=1706:960,pad=1920:1080:107:0:color=0xfbf8f3':'scale=1920:960,pad=1920:1080:0:0:color=0xfbf8f3';
    filters.push(`[${input}]trim=start=${s.sourceStart}:end=${s.sourceEnd},setpts=PTS-STARTPTS,fps=25,${layout},tpad=stop_mode=clone:stop_duration=${s.duration},trim=duration=${s.duration},setsar=1,settb=AVTB[v${j+1}]`);
  });
  filters.push(`${scenes.map((_,i)=>`[v${i}]`).join('')}concat=n=${scenes.length}:v=1:a=0,ass=captions.ass,fade=t=out:st=${duration-0.7}:d=0.7[v]`);
  filters.push('[0:a]aresample=48000,asetpts=PTS-STARTPTS[a0]');
  cues.slice(1).forEach((cue,i)=>filters.push(`[${i+4}:a]adelay=${Math.round(cue.start*1000)}:all=1[a${i+1}]`));
  filters.push(`${cues.map((_,i)=>`[a${i}]`).join('')}amix=inputs=${cues.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]`);
  const tools=process.env.FAMILYCOPILOT_DEMO_TOOLS;assert(tools && path.isAbsolute(tools));const ffmpeg=require(path.join(tools,'node_modules/ffmpeg-static'));
  const run=args=>{const r=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-n',...args],{cwd:output,encoding:'utf8',timeout:300000,maxBuffer:32768});if(r.status!==0)throw Error((r.stderr||'Render failed').slice(-2000));};
  run([...inputs.flatMap(p=>['-i',p]),'-filter_complex',filters.join(';'),'-map','[v]','-map','[a]','-t',String(duration),'-r','25','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-metadata:s:a:0','language=eng','-movflags','+faststart','familycopilot-complete-story.mp4']);
  run(['-i','familycopilot-complete-story.mp4','-f','null','-']);
  for(const [file,digest]of Object.entries(inputHashes))assert.equal(hash(path.join(root,file)),digest);
  for(const [name,time]of [['meet',16],['activities',scenes[2].start+0.5],['basketball',scenes[3].start+6.3],['ending',duration-5]])run(['-ss',String(time),'-i','familycopilot-complete-story.mp4','-frames:v','1',`review-${name}.png`]);
  const report={duration,decodePassed:true,sourceHashesMatched:true,newCalendarRequests:0,newPublicSearches:0,
    realCalendar:true,activitiesFromEarlierLiveCapture:true,syntheticCalendarFramesExcluded:true,
    introVoiceBridgeStartsBeforeCalendar:true,basketballVoiceAfterSelection:true,
    calendarFitClaimed:false,officialWebsiteEnding:true,subtitleTiming:'Approximate, not word-aligned',...read(path.join(output,'speech-verification.json'))};
  write('verification.json',report);console.log(JSON.stringify({output:path.relative(root,output),...report}));
}
function familyEditPlan(edit,capture){
  assert.equal(edit.version,1);assert.equal(edit.kind,'familycopilot.demo.family-edit');
  assert(Array.isArray(edit.segments) && edit.segments.length>=3 && edit.segments.length<=12);
  let cursor=0,previousEnd=0;
  const segments=edit.segments.map(segment=>{
    assert(['family','chapter','capture','movie'].includes(segment.kind));
    const speed=segment.speed??1;
    assert(Number.isFinite(speed) && speed>=1 && speed<=2);
    const holdSeconds=segment.holdSeconds??0;
    assert(Number.isFinite(holdSeconds) && holdSeconds>=0 && holdSeconds<=6);
    assert(holdSeconds===0 || segment.kind==='capture' && speed===1);
    const duration=segment.kind==='capture'?(segment.sourceEnd-segment.sourceStart)/speed+holdSeconds:segment.duration;
    assert(Number.isFinite(duration) && duration>0 && duration<=120);
    assert(Math.abs(duration*25-Math.round(duration*25))<1e-6);
    if(segment.kind==='movie'){
      assert.equal(speed,1);assert(duration>=3 && duration<=6);
      const loadingSeconds=segment.loadingSeconds??0;
      assert(Number.isFinite(loadingSeconds) && loadingSeconds>=0 && loadingSeconds<=2);
      assert(Math.abs(loadingSeconds*25-Math.round(loadingSeconds*25))<1e-6);
      assert(Number.isFinite(segment.clickStart) && segment.clickStart>=0);
      assert(Number.isFinite(segment.clickEnd) && segment.clickEnd>segment.clickStart && segment.clickEnd-segment.clickStart<duration);
      assert(segment.clickEnd-segment.clickStart+loadingSeconds<duration);
      assert(Math.abs(segment.clickStart*25-Math.round(segment.clickStart*25))<1e-6);
      assert(Math.abs(segment.clickEnd*25-Math.round(segment.clickEnd*25))<1e-6);
    }
    if(segment.kind==='capture'){
      assert(Number.isFinite(segment.sourceStart) && segment.sourceStart>=previousEnd && segment.sourceEnd<=capture.durationSeconds);
      assert(Math.abs(segment.sourceStart*25-Math.round(segment.sourceStart*25))<1e-6);
      previousEnd=segment.sourceEnd;
    }
    assert(Array.isArray(segment.cues));
    const captions=segment.cues.length?require('./finish-real-calendar-demo').captionTimeline(segment.cues,duration):[];
    for(const title of segment.titles||[]){
      assert(typeof title.text==='string' && title.text.length<=160 && !/[\x00-\x1f{}\\]/.test(title.text));
      assert(Number.isFinite(title.y) && title.y>=50 && title.y<=880);
      assert(Number.isFinite(title.size) && title.size>=18 && title.size<=70);
    }
    if(segment.animationStart!==undefined){
      assert(segment.kind==='family' && Number.isFinite(segment.animationStart) && segment.animationStart>=0);
      assert(Number.isFinite(segment.animationEnd) && segment.animationEnd>segment.animationStart && segment.animationEnd<=11.2);
    }
    const result={...segment,speed,holdSeconds,start:cursor,duration,captions:captions.map(cue=>({...cue,start:Math.round((cue.start+cursor)*100)/100,end:Math.round((cue.end+cursor)*100)/100}))};
    cursor=Math.round((cursor+duration)*25)/25;return result;
  });
  assert(segments.filter(segment=>segment.kind==='capture').length>=1);
  assert(segments.filter(segment=>segment.kind==='family').length>=1);
  assert(segments.filter(segment=>segment.kind==='movie').length<=1);
  return {segments,duration:cursor,captions:segments.flatMap(segment=>segment.captions)};
}
function familySpeechPlan(timeline,speech){
  assert.equal(speech.voice,'en-US-JennyNeural');assert.equal(speech.style,'friendly');assert.equal(speech.rate,'-3%');
  const cues=timeline.segments.flatMap(segment=>segment.cues.map(cue=>({...cue,start:segment.start+cue.start})));
  assert.equal(speech.audio.length,cues.length);
  return cues.map((cue,index)=>{
    const audio=speech.audio[index];assert.equal(audio.text,cue.text,'Narration must match its caption');
    assert(Number.isFinite(audio.seconds) && audio.seconds>0 && audio.seconds<=cue.seconds,'Voice must fit its cue');
    assert.match(audio.file,/^voice-\d+\.wav$/);assert.match(audio.sha256,/^[a-f0-9]{64}$/);
    assert(cue.start+audio.seconds<=timeline.duration);
    return {...audio,start:cue.start};
  });
}
function loadFamilyVoices(voices,resolve){
  assert(Array.isArray(voices) && voices.length>0 && voices.length<=14);
  const audio=voices.map(reference=>{
    const speechFile=resolve(reference.file);assert.equal(hash(speechFile),reference.sha256);
    const speech=read(speechFile);
    assert.equal(speech.voice,'en-US-JennyNeural');assert.equal(speech.style,'friendly');assert.equal(speech.rate,'-3%');
    let requestFile=null;
    if(reference.legacy){
      const scriptFile=resolve(reference.legacy.script.file),audioManifest=resolve(reference.legacy.audio.file);
      assert.equal(hash(scriptFile),reference.legacy.script.sha256);assert.equal(hash(audioManifest),reference.legacy.audio.sha256);
      const texts=read(scriptFile).narration,clips=read(audioManifest);
      assert(Array.isArray(texts) && Array.isArray(clips) && texts.length===clips.length);
      speech.audio=clips.map((clip,index)=>({...clip,text:texts[index]}));
    }else{
      requestFile=resolve(speech.requestFile);assert.equal(hash(requestFile),speech.requestSha256);
      const request=validateFamilySpeechRequest(read(requestFile));
      assert.deepEqual(speech.audio.map(item=>item.text),request.narration);
    }
    assert(Number.isInteger(reference.index) && reference.index>=0 && reference.index<speech.audio.length);
    const source=speech.audio[reference.index];assert.match(source.file,/^voice-\d+\.wav$/);
    const audioFile=resolve(path.join(path.dirname(speechFile),source.file));assert.equal(hash(audioFile),source.sha256);
    assert.equal(wavInfo(fs.readFileSync(audioFile)).seconds,source.seconds);
    const trimStart=reference.trimStart??0,trimEnd=reference.trimEnd??source.seconds,tempo=reference.tempo??1;
    assert(Number.isFinite(trimStart) && trimStart>=0 && trimStart<=1);
    assert(Number.isFinite(trimEnd) && trimEnd>trimStart && trimEnd<=source.seconds && source.seconds-trimEnd<=1.5);
    assert(Number.isFinite(tempo) && tempo>=1 && tempo<=1.2);
    return {...source,sourceSeconds:source.seconds,seconds:(trimEnd-trimStart)/tempo,trimStart,trimEnd,tempo,audioFile,
      speechFile,speechSha256:reference.sha256,requestFile,requestSha256:speech.requestSha256,legacy:reference.legacy};
  });
  return {voice:'en-US-JennyNeural',style:'friendly',rate:'-3%',audio};
}
function renderFamilyEdit(file,expectedHash){
  const base=fs.realpathSync(path.join(root,'browser-artifacts/demo'));
  const inside=target=>{const resolved=fs.realpathSync(target);assert(resolved.startsWith(base+path.sep));return resolved;};
  file=inside(file);assert.match(expectedHash,/^[a-f0-9]{64}$/);assert.equal(hash(file),expectedHash);
  const edit=read(file),resolve=relative=>inside(path.resolve(path.dirname(file),relative));
  const captureFile=resolve(edit.capture.file),capture=read(captureFile),image=resolve(edit.illustration.file);
  const video=inside(path.join(path.dirname(captureFile),'familycopilot-chat-preview.mp4'));
  const movieFile=edit.movie?resolve(edit.movie.file):null,movie=movieFile?read(movieFile):null;
  const movieImage=movie?inside(path.resolve(path.dirname(movieFile),movie.screenshot.file)):null;
  const movieClick=movie?inside(path.resolve(path.dirname(movieFile),movie.click.file)):null;
  const verifyMovie=()=>{
    if(!movie)return;
    assert.equal(hash(movieFile),edit.movie.sha256);
    assert.equal(movie.version,1);assert.equal(movie.kind,'familycopilot.demo.public-movie-still');
    assert.equal(movie.url,'https://www.vscinemas.com.tw/vsweb/film/detail.aspx?id=8786');
    assert.equal(movie.sameBrowserContinuous,false);assert.equal(movie.posterLoaded,true);
    assert.equal(hash(movieImage),movie.screenshot.sha256);assert.equal(hash(movieClick),movie.click.sha256);
    assert(Number.isFinite(movie.click.durationSeconds) && movie.click.durationSeconds>0);
    assert(movie.crop && ['width','height','x','y'].every(key=>Number.isInteger(movie.crop[key]) && movie.crop[key]>=0));
    assert(movie.crop.width>0 && movie.crop.height>0);
    const png=fs.readFileSync(movieImage);assert.equal(png.subarray(1,4).toString(),'PNG');
    assert(movie.crop.x+movie.crop.width<=png.readUInt32BE(16));assert(movie.crop.y+movie.crop.height<=png.readUInt32BE(20));
  };
  assert(capture.syntheticOnly && capture.fullDecodePassed && capture.forbiddenRequests===0 && capture.browserErrors===0);
  assert.equal(capture.width,1440);assert.equal(capture.height,1020);assert.match(capture.narration,/^none:/);
  const verify=()=>{assert.equal(hash(file),expectedHash);assert.equal(hash(captureFile),edit.capture.sha256);assert.equal(hash(image),edit.illustration.sha256);assert.equal(hash(video),capture.videoSha256);};
  verify();const timeline=familyEditPlan(edit,capture);
  assert.equal(Boolean(movie),timeline.segments.some(segment=>segment.kind==='movie'));verifyMovie();
  for(const segment of timeline.segments.filter(item=>item.kind==='movie'))assert(segment.clickEnd<=movie.click.durationSeconds);
  assert(!(edit.speech && edit.voices));
  const speechFile=edit.speech?resolve(edit.speech.file):null,speech=edit.voices?loadFamilyVoices(edit.voices,resolve):speechFile?read(speechFile):null;
  const audio=speech?familySpeechPlan(timeline,speech):[];
  const audioFiles=audio.map(item=>item.audioFile||inside(path.join(path.dirname(speechFile),item.file)));
  const verifyAudio=()=>{
    if(!speech)return;
    if(edit.voices){assert.deepEqual(loadFamilyVoices(edit.voices,resolve),speech);return;}
    assert.equal(hash(speechFile),edit.speech.sha256);
    const requestFile=inside(speech.requestFile);assert.equal(hash(requestFile),speech.requestSha256);
    const request=validateFamilySpeechRequest(read(requestFile));assert.deepEqual(audio.map(item=>item.text),request.narration);
    audioFiles.forEach((audioFile,index)=>{assert.equal(hash(audioFile),audio[index].sha256);assert.equal(wavInfo(fs.readFileSync(audioFile)).seconds,audio[index].seconds);});
  };
  verifyAudio();
  const output=fs.mkdtempSync(path.join(base,'family-story-'));
  const save=(name,content)=>fs.writeFileSync(path.join(output,name),content,{flag:'wx',mode:0o600});
  const tools=process.env.FAMILYCOPILOT_DEMO_TOOLS;assert(tools && path.isAbsolute(tools));
  const ffmpeg=require(path.join(tools,'node_modules/ffmpeg-static'));
  let ass='[Script Info]\nScriptType: v4.00+\nPlayResX: 1440\nPlayResY: 1020\nWrapStyle: 0\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,DejaVu Sans,28,&H00FFFFFF,&H00FFFFFF,&H0025291F,&H0025291F,0,0,0,0,100,100,0,0,1,0,0,2,65,65,38,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
  for(const cue of timeline.captions)ass+=`Dialogue: 0,${stamp(cue.start,true)},${stamp(cue.end,true)},Caption,,0,0,0,,${cue.text}\n`;
  for(const segment of timeline.segments)for(const title of segment.titles||[]){
    ass+=`Dialogue: 1,${stamp(segment.start,true)},${stamp(segment.start+segment.duration,true)},Caption,,0,0,0,,{\\an5\\pos(720,${title.y})\\fs${title.size}\\c&H00363E19&\\bord0\\shad0\\fad(250,250)}${title.text}\n`;
  }
  save('captions.ass',ass);
  const captionsFile='familycopilot-family-story.en.srt',videoFile='familycopilot-family-story.mp4';
  save(captionsFile,timeline.captions.map((cue,index)=>`${index+1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n`).join('\n'));
  const captures=timeline.segments.filter(segment=>segment.kind==='capture'),families=timeline.segments.filter(segment=>segment.kind==='family');
  const filters=[`[0:v]split=${captures.length}${captures.map((_,index)=>`[capture${index}]`).join('')}`,
    `[1:v]${edit.illustration.kind==='video'?'crop=1920:760:0:320,scale=1440:570':'crop=1920:680:0:400,scale=1440:510'},pad=1440:1020:0:350:color=0xf6f2e8,split=${families.length}${families.map((_,index)=>`[family${index}]`).join('')}`];
  let captureIndex=0,familyIndex=0;
  for(const [index,segment] of timeline.segments.entries()){
    if(segment.kind==='movie'){
      const movieInput=2+audioFiles.length,clickDuration=segment.clickEnd-segment.clickStart,loadingSeconds=segment.loadingSeconds??0;
      filters.push(`[${movieInput}:v]trim=start=${segment.clickStart}:end=${segment.clickEnd},setpts=PTS-STARTPTS,pad=1440:1020:0:0:color=0x25291f,fps=25${loadingSeconds?`,tpad=stop_mode=clone:stop=${Math.round(loadingSeconds*25)}`:''},setsar=1,settb=AVTB[movieClick]`);
      filters.push(`[${movieInput+1}:v]crop=${movie.crop.width}:${movie.crop.height}:${movie.crop.x}:${movie.crop.y},scale=1440:900,pad=1440:1020:0:0:color=0x25291f,trim=duration=${segment.duration-clickDuration-loadingSeconds},setpts=PTS-STARTPTS,fps=25,setsar=1,settb=AVTB[movieStill]`);
      filters.push(`[movieClick][movieStill]concat=n=2:v=1:a=0[v${index}]`);continue;
    }
    const filter=segment.kind==='capture'?`[capture${captureIndex++}]trim=start=${segment.sourceStart}:end=${segment.sourceEnd},crop=1440:900:0:0,pad=1440:1020:0:0:color=0x25291f`:
      segment.kind==='family'?`[family${familyIndex++}]${edit.illustration.kind==='video'?`trim=start=${segment.animationStart}:end=${segment.animationEnd},setpts=(PTS-STARTPTS)*${segment.duration/(segment.animationEnd-segment.animationStart)}`:`trim=duration=${segment.duration}`},drawbox=x=0:y=900:w=1440:h=120:color=0x25291f:t=fill`:
        `color=c=0xf4f6f2:s=1440x1020:r=25:d=${segment.duration},drawbox=x=0:y=900:w=1440:h=120:color=0x25291f:t=fill`;
    if(segment.kind==='family' && edit.illustration.kind==='video')assert(segment.animationStart!==undefined);
    filters.push(`${filter},setpts=(PTS-STARTPTS)/${segment.speed},fps=25${segment.holdSeconds?`,tpad=stop_mode=clone:stop=${Math.round(segment.holdSeconds*25)}`:''},setsar=1,settb=AVTB[v${index}]`);
  }
  filters.push(`${timeline.segments.map((_,index)=>`[v${index}]`).join('')}concat=n=${timeline.segments.length}:v=1:a=0,ass=captions.ass,fade=t=in:d=0.3,fade=t=out:st=${timeline.duration-.6}:d=0.6[video]`);
  if(speech){
    audio.forEach((item,index)=>filters.push(`[${index+2}:a]${item.audioFile?`atrim=start=${item.trimStart}:end=${item.trimEnd},asetpts=PTS-STARTPTS,atempo=${item.tempo},`:''}adelay=${Math.round(item.start*1000)}:all=1[a${index}]`));
    filters.push(`${audio.map((_,index)=>`[a${index}]`).join('')}amix=inputs=${audio.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad[narration]`);
  }
  const run=args=>{const result=spawnSync(ffmpeg,['-nostdin','-hide_banner','-n',...args],{cwd:output,encoding:'utf8',timeout:300000,maxBuffer:1048576});assert.equal(result.status,0,(result.stderr||'Family edit failed').slice(-2000));return result.stderr;};
  run(['-loglevel','error','-i',video,...(edit.illustration.kind==='video'?[]:['-loop','1','-framerate','25']),'-i',image,...audioFiles.flatMap(audioFile=>['-i',audioFile]),
    ...(movie?['-i',movieClick,'-loop','1','-framerate','25','-i',movieImage]:[]),
    '-filter_complex',filters.join(';'),'-map','[video]',...(speech?['-map','[narration]','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-metadata:s:a:0','language=eng','-disposition:a:0','default']:['-an']),
    '-t',String(timeline.duration),'-r','25','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',videoFile]);
  const decoded=run(['-i',videoFile,'-f','null','-']);assert.match(decoded,/Video: h264.*1440x1020/);
  let audioLevels=null;
  if(speech){
    assert.match(decoded,/Audio: aac.*48000 Hz, stereo/);
    const measured=run(['-i',videoFile,'-vn','-af','volumedetect','-f','null','-']);
    const mean=measured.match(/mean_volume: (-?[\d.]+) dB/),peak=measured.match(/max_volume: (-?[\d.]+) dB/);assert(mean && peak);
    audioLevels={meanDb:Number(mean[1]),peakDb:Number(peak[1])};assert(audioLevels.meanDb>-45 && audioLevels.peakDb<0);
  }else assert(!/Stream #.*Audio:/.test(decoded));
  const duration=decoded.match(/Duration: (\d+):(\d+):([\d.]+)/);assert(duration);assert(Math.abs(Number(duration[1])*3600+Number(duration[2])*60+Number(duration[3])-timeline.duration)<.04);
  const frames=[];
  for(const [index,segment] of timeline.segments.entries()){
    const name=`review-${index+1}-${segment.kind}.png`;frames.push(name);
    run(['-loglevel','error','-ss',String(segment.start+segment.duration-1),'-i',videoFile,'-frames:v','1',name]);
  }
  verify();verifyAudio();verifyMovie();save('manifest.json',JSON.stringify({version:1,kind:'familycopilot.demo.family-story',videoFile,captionsFile,
    videoSha256:hash(path.join(output,videoFile)),captionsSha256:hash(path.join(output,captionsFile)),editFile:file,editSha256:expectedHash,rendererSha256:hash(__filename),
    captureFile,captureSha256:edit.capture.sha256,sourceVideoSha256:capture.videoSha256,illustration:image,illustrationSha256:edit.illustration.sha256,
    ...timeline,width:1440,height:1020,framesPerSecond:25,audio:speech?'Jenny_AAC_48000_stereo':'none_intentional',audioLevels,
    speech:speech?{file:speechFile,sha256:edit.speech?.sha256,voice:speech.voice,clips:audio,humanAudition:'pending'}:null,
    movie:movie?{file:movieFile,sha256:edit.movie.sha256,...movie}:null,
    fullDecodePassed:true,sourceHashesUnchanged:true,
    captionBoundsPassed:true,newRecording:false,newSpeechRequests:0,networkRequests:0,productChanged:false,reviewFrames:frames,
    visualReview:'pending',humanContinuousReview:'pending',limitations:edit.limitations},null,2)+'\n');
  console.log(JSON.stringify({output:path.relative(root,output),duration:timeline.duration,fullDecodePassed:true}));
}
function validateFamilySpeechRequest(request){
  assert.equal(request.version,1);
  for(const [key,value] of Object.entries({provider:'Azure AI Speech',resource:'hackathon-VDI-taipei-tts',resourceGroup:'ReceiptModeling',
    subscription:'609bbde3-d152-4d7d-a12b-005e38ac4f27',endpoint:'https://eastus.tts.speech.microsoft.com/cognitiveservices/v1',
    voice:'en-US-JennyNeural',style:'friendly',rate:'-3%',format:'riff-48khz-16bit-mono-pcm',
    credentialReads:1,automaticRetries:0,alternateProviders:false,resourceChanges:false,
    privateCalendarContentSent:false,namesSent:false}))assert.equal(request[key],value,key);
  assert(Number.isInteger(request.maximumSynthesisRequests) && request.maximumSynthesisRequests>=1 && request.maximumSynthesisRequests<=12);
  assert(Number.isInteger(request.maximumTextCharacters) && request.maximumTextCharacters>=1 && request.maximumTextCharacters<=1500);
  assert(Array.isArray(request.narration) && request.narration.length>0 && request.narration.length<=request.maximumSynthesisRequests);
  for(const text of request.narration)assert(typeof text==='string' && text.trim() && text.length<=500 && !/[\x00-\x1f{}\\]/.test(text));
  assert(request.narration.join('').length<=request.maximumTextCharacters);
  return request;
}
async function synthesizeFamilySpeech(file,expectedHash){
  const base=fs.realpathSync(path.join(root,'browser-artifacts/demo'));
  file=fs.realpathSync(file);assert(file.startsWith(base+path.sep));
  assert.match(expectedHash,/^[a-f0-9]{64}$/);assert.equal(hash(file),expectedHash);
  const request=validateFamilySpeechRequest(read(file)),output=path.join(path.dirname(file),'jenny-approved');
  fs.mkdirSync(output,{mode:0o700});
  const save=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
  save('attempt.json',{requestFile:file,requestSha256:expectedHash,startedAt:new Date().toISOString(),maximumRequests:request.maximumSynthesisRequests,automaticRetries:0});
  const {escapeXML}=require('./finish-integrated-demo');
  let key='',requests=0,stage='credential';
  try{
    const credential=spawnSync('az',['cognitiveservices','account','keys','list','--subscription',request.subscription,
      '--resource-group',request.resourceGroup,'--name',request.resource,'--query','key1','-o','tsv','--only-show-errors'],
      {timeout:30000,maxBuffer:16384,stdio:['ignore','pipe','pipe']});
    if(credential.status!==0){credential.stdout?.fill(0);credential.stderr?.fill(0);throw Error('credential_unavailable');}
    key=credential.stdout.toString('utf8').trim();credential.stdout.fill(0);credential.stderr?.fill(0);
    assert(key.length>0 && key.length<512 && !/[\r\n]/.test(key));
    const audio=[];
    for(const [index,text] of request.narration.entries()){
      stage=`voice_${index+1}`;assert.equal(hash(file),expectedHash);
      const body=`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US"><voice name="en-US-JennyNeural"><mstts:express-as style="friendly"><prosody rate="-3%">${escapeXML(text)}</prosody></mstts:express-as></voice></speak>`;
      assert(body.length<4000);requests++;
      const response=await fetch(request.endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(60000),headers:{
        'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':request.format},body});
      if(response.status!==200){stage+=`_http_${response.status}`;await response.body?.cancel();throw Error('speech_rejected');}
      let bytes=0;const parts=[];
      for await(const part of response.body){bytes+=part.length;assert(bytes<=12*1024*1024);parts.push(part);}
      const buffer=Buffer.concat(parts),info=wavInfo(buffer),name=`voice-${index+1}.wav`;
      assert(info.seconds>0 && info.seconds<25);
      fs.writeFileSync(path.join(output,name),buffer,{flag:'wx',mode:0o600});
      audio.push({file:name,text,...info,sha256:hash(path.join(output,name))});
    }
    assert.equal(hash(file),expectedHash);
    save('speech.json',{version:1,requestFile:file,requestSha256:expectedHash,voice:request.voice,style:request.style,rate:request.rate,
      requests,textCharacters:request.narration.join('').length,audio,privateCalendarContentSent:false,resourceModified:false,humanAudition:'pending'});
    console.log(JSON.stringify({output:path.relative(root,output),requests,seconds:audio.map(item=>item.seconds)}));
  }catch{
    save('failure.json',{stage,requests,automaticRetry:false});throw Error(`Speech stopped at ${stage}; requests=${requests}; no automatic retry`);
  }finally{key='';}
}
module.exports={plan,render,familyEditPlan,familySpeechPlan,loadFamilyVoices,renderFamilyEdit,validateFamilySpeechRequest,synthesizeFamilySpeech};
if(require.main===module){
  Promise.resolve().then(()=>{
    assert.equal(process.argv.length,6);assert.equal(process.argv[4],'--sha256');
    if(process.argv[2]==='--family-speech-approved')return synthesizeFamilySpeech(path.resolve(process.argv[3]),process.argv[5]);
    assert.equal(process.argv[2],'--family-edit');return renderFamilyEdit(path.resolve(process.argv[3]),process.argv[5]);
  }).catch(error=>{console.error(error.message);process.exitCode=1;});
}