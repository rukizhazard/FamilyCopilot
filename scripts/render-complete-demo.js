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
module.exports={plan,render};