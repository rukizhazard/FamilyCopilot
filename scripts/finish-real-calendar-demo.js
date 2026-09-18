"use strict";
// Fixed real capture; no calendar access. Speech sends only the generic script below.
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'), {createHash}=require('node:crypto');
const {wavInfo,escapeXML,stamp,chunks}=require('./finish-integrated-demo');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'browser-artifacts/demo/real-calendar-LHXjcP');
const intro=path.join(root,'browser-artifacts/demo/family-intro-6gKRQp/familycopilot-family-intro.mp4');
const fullStory=['--synthesize-full-approved','--render-full-offline'].includes(process.argv[2]);
const output=path.join(source,fullStory?'complete-story':'finished');
const transitionNarration=[
  "Let's meet Family Copilot. Here are our plans for the weekend, together in one view. We can look across the family calendars and consider where an outing might fit.",
  "With those commitments in view, let's look for something to do within these dates. Next, we'll bring in the family's interests, and turn a possible opening into an idea worth exploring."
];
const narration=fullStory?transitionNarration:[
  "Our calendars are already loaded. Now we can look at the weekend together, instead of piecing together separate plans. We can see where commitments fall and which times deserve a closer look.",
  "With the week's commitments in view, the next question is what we'd enjoy doing together. Let's explore an activity that matches our interests, then check the details before deciding."
];
const introText="Between work, school, and everyday routines, family time can be easy to put off. This weekend, let's do something together. But when could we go, and what would everyone enjoy?";
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(name,data)=>fs.writeFileSync(path.join(output,name),JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
function inputs(){
  const capture=read(path.join(source,'capture.json'));
  assert(capture.savedViewOnly && capture.calendarProviderRequests===0 && !capture.syntheticCalendars && !capture.urgent && capture.childNamesMasked);
  assert(/^[\w@.-]+\.webm$/.test(capture.raw));
  return capture;
}
async function synthesize(){
  const capture=inputs();
  fs.mkdirSync(output,{mode:0o700}); // One-shot marker, no retries or overwrite.
  write('source-hashes.json',{capture:hash(path.join(source,'capture.json')),raw:hash(path.join(source,capture.raw)),intro:hash(intro)});
  write('script.json',{narration,introText});
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
      audio.push({file,...info,sha256:hash(path.join(output,file))});
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
if(require.main===module){
  assert.equal(process.argv.length,3);
  if(['--synthesize-approved','--synthesize-full-approved'].includes(process.argv[2]))synthesize().catch(()=>{console.error('Source or attempt marker invalid.');process.exitCode=1;});
  else if(['--render-offline','--render-full-offline'].includes(process.argv[2])){
    try{if(fullStory)require('./render-complete-demo').render({source,intro,output,narration,introText});else render();}catch(e){console.error(e.message);process.exitCode=1;}
  }else throw Error('Explicit synthesis or offline render required');
}
module.exports={narration,transitionNarration};