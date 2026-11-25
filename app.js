(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const state = { files: [], slides: [], busy: false, promptVersion: "v2" };
  const MAX_FILES = 30, MAX_FILE_MB = 18, W = 1080, H = 1350;
  const DESIGN_GUIDE = `You are a senior travel scrapbook art director. Create an authentic, premium mixed-media travel journal. Visual language: tactile torn paper, layered photographs, instant-photo/Polaroid frames, handwritten notes, small relevant cutout stickers, subtle shadows, warm paper grain, nostalgic but photograph-led. Use intentional imperfection, asymmetry and varied slide rhythm. Do not repeat one template. Alternate full-bleed, torn split, layered collage, framed detail and quiet closing compositions. Photography is the hero. Preserve authenticity; never invent landmarks, activities, dates, coordinates or people. If location is uncertain, say so. Text must be short and legible. Avoid placing important text over busy areas. Output strict JSON only, no markdown fences.`;
  const LAYOUTS = ["hero","polaroid","split","collage","note","closing"];
  const progress = (pct, title, message, step) => {
    $("progressSection").hidden = false; $("progressTitle").textContent = title; $("progressMessage").textContent = message; $("progressPercent").textContent = pct + "%"; $("progressBar").style.width = pct + "%";
    [...$("progressSteps").children].forEach((el,i)=>el.classList.toggle("active",i===step));
  };
  function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),3200);}
  function updateCount(){ $("imageCount").textContent = state.files.length + (state.files.length===1?" PHOTO":" PHOTOS"); $("generateButton").disabled = state.files.length<3 || state.busy; $("clearPhotos").hidden=!state.files.length; }
  function addFiles(fileList){
    const incoming=[...fileList].filter(f=>f.type.startsWith("image/"));
    if(!incoming.length){toast("Please choose image files.");return;}
    for(const file of incoming){
      if(state.files.length>=MAX_FILES){toast("Maximum 30 photographs per project.");break;}
      if(file.size>MAX_FILE_MB*1024*1024){toast(file.name+" is larger than 18 MB.");continue;}
      if(state.files.some(x=>x.name===file.name&&x.size===file.size)){continue;}
      state.files.push({file,id:"IMG_"+String(state.files.length+1).padStart(3,"0"),url:URL.createObjectURL(file),analysis:null});
    }
    renderUploads(); updateCount();
  }
  function renderUploads(){
    $("photoGrid").innerHTML="";
    state.files.forEach((item,index)=>{
      const card=document.createElement("div");card.className="photo-thumb";
      const img=document.createElement("img");img.src=item.url;img.alt=item.file.name;
      const label=document.createElement("span");label.textContent=item.id+" · "+item.file.name.slice(0,18);
      const remove=document.createElement("button");remove.type="button";remove.textContent="×";remove.setAttribute("aria-label","Remove "+item.file.name);
      remove.onclick=()=>{URL.revokeObjectURL(item.url);state.files.splice(index,1);state.files.forEach((x,i)=>x.id="IMG_"+String(i+1).padStart(3,"0"));renderUploads();updateCount();};
      card.append(img,label,remove);$("photoGrid").append(card);
    });
  }
  $("browseButton").onclick=()=> $("fileInput").click();
  $("dropzone").onclick=(e)=>{if(e.target.id!=="browseButton")$("fileInput").click();};
  $("dropzone").onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();$("fileInput").click();}};
  $("fileInput").onchange=e=>{addFiles(e.target.files);e.target.value="";};
  ["dragenter","dragover"].forEach(name=>$("dropzone").addEventListener(name,e=>{e.preventDefault();$("dropzone").classList.add("dragover");}));
  ["dragleave","drop"].forEach(name=>$("dropzone").addEventListener(name,e=>{e.preventDefault();$("dropzone").classList.remove("dragover");}));
  $("dropzone").addEventListener("drop",e=>addFiles(e.dataTransfer.files));
  $("clearPhotos").onclick=()=>{state.files.forEach(x=>URL.revokeObjectURL(x.url));state.files=[];renderUploads();updateCount();};

  function extractText(response){
    const msg=response?.message;
    if(typeof msg?.content==="string")return msg.content;
    if(Array.isArray(msg?.content))return msg.content.map(x=>x.text||"").join("\n");
    if(typeof response==="string")return response;
    return JSON.stringify(response);
  }
  function parseJSON(text){
    const clean=text.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim();
    const start=clean.indexOf("{"),end=clean.lastIndexOf("}");
    if(start<0||end<start)throw new Error("AI did not return a valid storyboard. Please try again.");
    return JSON.parse(clean.slice(start,end+1));
  }
  async function callAI(prompt, file, model="gpt-6-luna"){
    if(!window.puter?.ai?.chat)throw new Error("Puter.js did not load. Refresh the page and try again.");
    const response=file ? await puter.ai.chat(prompt,file,false,{model,temperature:0.35,max_tokens:1200}) : await puter.ai.chat(prompt,{model,temperature:0.55,max_tokens:6500});
    return extractText(response);
  }
  async function analysePhotos(destination,vibe){
    const results=[];
    for(let i=0;i<state.files.length;i++){
      const item=state.files[i];
      progress(5+Math.round((i/state.files.length)*35),"Looking closely…","Analysing "+item.id+" ("+(i+1)+" of "+state.files.length+")",0);
      const prompt=`Analyse this travel photograph for a carousel art director. Destination context: ${destination||"not specified"}. Vibe: ${vibe}. Return concise JSON with keys: image_id (string), subject (string), setting (string), likely_location (string or "unknown"), location_confidence ("high"|"medium"|"low"), visual_role (one of hero|landscape|portrait|architecture|food|activity|detail|group|nightlife|candid), dominant_colours (array of 3 strings), composition (string), focal_point (string), negative_space (string), crop_advice (string), quality (string), story_value (string). Never claim an exact landmark unless visually clear.`;
      try{const text=await callAI(prompt,item.file);item.analysis=parseJSON(text);item.analysis.image_id=item.id;results.push(item.analysis);}
      catch(error){console.warn("Photo analysis fallback",item.id,error);item.analysis={image_id:item.id,subject:"Travel photograph",setting:"Uncertain",likely_location:"unknown",location_confidence:"low",visual_role:"candid",dominant_colours:[],composition:"Use visual inspection",focal_point:"Main visible subject",negative_space:"Assess during layout",crop_advice:"Preserve full subject",quality:"Not assessed",story_value:"Potential personal memory"};results.push(item.analysis);}
    }
    return results;
  }
  function buildPlanPrompt(brief,analyses){
    const count=brief.count==="auto"?"Choose between 5 and 10 slides based on the strongest images":brief.count+" slides";
    return `${DESIGN_GUIDE}
You are creating a carousel plan for an actual browser-based renderer. Return JSON matching:
{"title":"short title","creative_direction":"one sentence","palette":["#hex",...],"slides":[{"title":"short slide title","purpose":"story purpose","layout":"hero|polaroid|split|collage|note|closing","images":["IMG_001"],"caption":"short optional text","location_label":"optional factual label","background":"#hex","sticker":"none|star|shell|flower|camera|sparkle|ticket|tape","rotation":-5,"image_focus":"center|top|bottom","design_note":"short direction"}]}
Rules:
- Create ${count}. Use only supplied image IDs and use each selected photo no more than twice.
- The first slide is a dedicated cover: choose the strongest single photograph, use a memorable short title/caption (ideally 2–6 words), and a factual destination label when known. The final slide should feel like a closing memory.
- Use varied layouts and a narrative flow; avoid repeating layout more than twice consecutively.
- Only use a location label if supported by image analysis or the user destination. Do not make up specific venues.
- Captions must be short. Respect text preference.
- For the scrapbook style, use torn-paper/Polaroid/sticker motifs selectively. Renderer has six supported layouts only.
- For "No text", caption and location_label must be empty.
- Do not include markdown or explanatory prose outside JSON.
CREATIVE BRIEF:
Destination: ${brief.destination||"Not specified"}
Vibe: ${brief.vibe}
Travel context: ${brief.company}
Mood: ${brief.mood}
Design direction: ${brief.style}
Text: ${brief.text}
Extra notes: ${brief.notes||"None"}
Image analysis:
${JSON.stringify(analyses)}
`;
  }
  async function createStoryboard(brief,analyses){
    progress(44,"Finding the story…","The art director is sequencing your memories.",1);
    const text=await callAI(buildPlanPrompt(brief,analyses),null);
    const plan=parseJSON(text);
    if(!Array.isArray(plan.slides)||!plan.slides.length)throw new Error("The AI storyboard did not contain slides.");
    plan.slides=plan.slides.slice(0,12).map((s,i)=>({
      title:String(s.title||"A little memory").slice(0,60),
      purpose:String(s.purpose||"Travel memory").slice(0,180),
      layout:LAYOUTS.includes(s.layout)?s.layout:"hero",
      images:(Array.isArray(s.images)?s.images:[]).filter(id=>state.files.some(f=>f.id===id)).slice(0,3),
      caption:String(s.caption||"").slice(0,100),
      location_label:String(s.location_label||"").slice(0,70),
      background:/^#[0-9a-f]{6}$/i.test(s.background||"")?s.background:"#eee5d9",
      sticker:["none","star","shell","flower","camera","sparkle","ticket","tape"].includes(s.sticker)?s.sticker:"none",
      rotation:Math.max(-12,Math.min(12,Number(s.rotation)||0)),
      image_focus:["center","top","bottom"].includes(s.image_focus)?s.image_focus:"center",
      design_note:String(s.design_note||"")
    })).filter(s=>s.images.length);
    if(!plan.slides.length)throw new Error("The AI did not select any of your uploaded photographs. Try again.");
    return plan;
  }
  function loadImage(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url;});}
  function roundedRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
  function drawCover(ctx,img,x,y,w,h,focus="center"){
    const scale=Math.max(w/img.width,h/img.height),sw=w/scale,sh=h/scale;
    let sx=(img.width-sw)/2,sy=(img.height-sh)/2;
    if(focus==="top")sy=0;if(focus==="bottom")sy=img.height-sh;
    ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);
  }
  function paperNoise(ctx){
    ctx.save();ctx.globalAlpha=.055;for(let i=0;i<1700;i++){const x=Math.random()*W,y=Math.random()*H;ctx.fillStyle=Math.random()>.5?"#fff":"#6d5947";ctx.fillRect(x,y,1.5,1.5);}ctx.restore();
  }
  function drawTornPanel(ctx,x,y,w,h,color){
    ctx.save();ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y+8);
    for(let px=x;px<=x+w;px+=22)ctx.lineTo(px,y+Math.random()*12);
    ctx.lineTo(x+w,y+h-8);for(let px=x+w;px>=x;px-=22)ctx.lineTo(px,y+h-Math.random()*12);
    ctx.closePath();ctx.fill();ctx.restore();
  }
  function drawSticker(ctx,type,x,y){
    if(!type||type==="none")return;ctx.save();ctx.translate(x,y);ctx.rotate(-.12);
    ctx.font="100px Georgia";ctx.textAlign="center";ctx.textBaseline="middle";
    const chars={star:"✳",shell:"🐚",flower:"✿",camera:"📷",sparkle:"✦",ticket:"✉",tape:"▰"};
    ctx.shadowColor="#30271d33";ctx.shadowBlur=8;ctx.fillStyle=type==="tape"?"#e7bd83":"#fffaf0";ctx.fillText(chars[type]||"✦",0,0);ctx.restore();
  }
  function drawText(ctx,text,x,y,maxWidth,font,color,align="left",options={}){
    if(!text)return;
    const {maxLines=3,lineHeight=48,minFontSize=20}=options;
    ctx.save();ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline="middle";
    const parsed=font.match(/(\d+(?:\.\d+)?)px/);let fontSize=parsed?Number(parsed[1]):40;
    const family=font.replace(/(?:italic\s+)?\d+(?:\.\d+)?px\s*/,"");
    const italic=/^italic/.test(font);
    const makeLines=(size)=>{
      ctx.font=(italic?"italic ":"")+size+"px "+family;
      const lines=[];let line="";
      for(const word of String(text).trim().split(/\s+/)){
        if(ctx.measureText(word).width>maxWidth){
          if(line){lines.push(line);line="";}
          let part="";
          for(const char of word){if(ctx.measureText(part+char).width>maxWidth&&part){lines.push(part);part=char;}else part+=char;}
          line=part;continue;
        }
        const test=line?line+" "+word:word;
        if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;
      }
      if(line)lines.push(line);
      return lines;
    };
    let lines=makeLines(fontSize);
    while(lines.length>maxLines&&fontSize>minFontSize){fontSize-=2;lines=makeLines(fontSize);}
    if(lines.length>maxLines){lines=lines.slice(0,maxLines);let last=lines[maxLines-1];while(last.length&&ctx.measureText(last+"…").width>maxWidth)last=last.slice(0,-1);lines[maxLines-1]=last.trimEnd()+"…";}
    ctx.font=(italic?"italic ":"")+fontSize+"px "+family;
    lines.forEach((line,i)=>ctx.fillText(line,x,y+i*lineHeight));
    ctx.restore();
  }
  function drawCaptionCard(ctx,text,config){
    if(!text)return;
    config=config||{};
    const x=config.x==null?64:config.x;
    const y=config.y==null?H-250:config.y;
    const width=config.width==null?720:config.width;
    const fontSize=config.fontSize==null?46:config.fontSize;
    const minFontSize=config.minFontSize==null?30:config.minFontSize;
    const maxLines=config.maxLines==null?3:config.maxLines;
    const background=config.background||"#f4dfc4";
    const color=config.color||"#44372b";
    const padX=34,padY=27,innerWidth=width-padX*2;
    const family="'Playfair Display', Georgia";
    let size=fontSize,lines=[];
    function wrap(){
      ctx.font="italic "+size+"px "+family;
      const out=[];let line="";
      const words=String(text).trim().split(/\s+/);
      for(const word of words){
        const candidate=line?line+" "+word:word;
        if(ctx.measureText(candidate).width<=innerWidth){line=candidate;continue;}
        if(line)out.push(line);
        if(ctx.measureText(word).width>innerWidth){
          let part="";
          for(const ch of word){
            if(ctx.measureText(part+ch).width>innerWidth&&part){out.push(part);part=ch;}
            else part+=ch;
          }
          line=part;
        }else line=word;
      }
      if(line)out.push(line);
      return out;
    }
    lines=wrap();
    while(lines.length>maxLines&&size>minFontSize){size-=2;lines=wrap();}
    if(lines.length>maxLines){
      lines=lines.slice(0,maxLines);
      let last=lines[maxLines-1];
      while(last.length&&ctx.measureText(last+"…").width>innerWidth)last=last.slice(0,-1);
      lines[maxLines-1]=last.trimEnd()+"…";
    }
    const lh=config.lineHeight||Math.round(size*1.24);
    const height=lines.length*lh+padY*2;
    const safeY=Math.max(36,Math.min(y,H-height-36));
    drawTornPanel(ctx,x,safeY,width,height,background);
    ctx.save();ctx.fillStyle=color;ctx.font="italic "+size+"px "+family;ctx.textAlign=config.align||"left";ctx.textBaseline="middle";
    const tx=config.align==="center"?x+width/2:x+padX;
    lines.forEach((line,i)=>ctx.fillText(line,tx,safeY+padY+lh*(i+.5),innerWidth));
    ctx.restore();
  }
  function hasProminentPerson(item){
    const a=item?.analysis||{};
    const role=String(a.visual_role||"").toLowerCase();
    const subject=String(a.subject||"").toLowerCase();
    return ["portrait","group"].includes(role)||/person|people|woman|man|child|selfie|portrait|family|couple/.test(subject);
  }
  function renderCoverSlide(ctx,slide,first){
    drawCover(ctx,first,0,0,W,H,slide.image_focus);
    const shade=ctx.createLinearGradient(0,0,0,H);
    shade.addColorStop(0,"#00000055");
    shade.addColorStop(.42,"#00000000");
    shade.addColorStop(.68,"#00000010");
    shade.addColorStop(1,"#00000055");
    ctx.fillStyle=shade;
    ctx.fillRect(0,0,W,H);
    if(slide.location_label){
      drawText(ctx,slide.location_label.toUpperCase(),76,92,760,"22px 'DM Mono', monospace","#fff");
    }
    const title=slide.caption||slide.title||"A journey to remember";
    drawCaptionCard(ctx,title,{x:54,y:H-300,width:972,fontSize:66,minFontSize:42,maxLines:2,background:"#f2dfc2",lineHeight:78});
    ctx.save();
    ctx.strokeStyle="#b88b62";
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(88,H-58);
    ctx.lineTo(280,H-58);
    ctx.stroke();
    ctx.restore();
    drawSticker(ctx,slide.sticker==="none"?"flower":slide.sticker,W-145,180);
  }
  async function renderSlide(slide,index,plan){
    const canvas=document.createElement("canvas");canvas.width=W;canvas.height=H;const ctx=canvas.getContext("2d");
    ctx.fillStyle=slide.background;ctx.fillRect(0,0,W,H);
    const selected=slide.images.map(id=>state.files.find(f=>f.id===id)).filter(Boolean);
    const imgs=await Promise.all(selected.map(f=>loadImage(f.url)));
    const first=imgs[0];
    const layout=slide.layout;
    if(index===0){
      renderCoverSlide(ctx,slide,first);
    }else if(layout==="hero"){
      drawCover(ctx,first,0,0,W,H,slide.image_focus);
      const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,"#00000030");grad.addColorStop(.55,"#00000000");grad.addColorStop(1,"#00000060");ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
      if(slide.location_label)drawText(ctx,slide.location_label.toUpperCase(),72,100,850,"22px 'DM Mono', monospace","#fff");
      if(slide.caption)drawCaptionCard(ctx,slide.caption,{x:62,y:H-280,width:Math.min(820,W-124),fontSize:48,minFontSize:32,maxLines:3,background:"#f0d6ad"});
    }else if(layout==="split"){
      drawCover(ctx,first,0,0,W*.56,H,slide.image_focus);
      if(imgs[1])drawCover(ctx,imgs[1],W*.58,0,W*.42,H);
      drawTornPanel(ctx,W*.54,0,45,H,"#f5eee3");
      if(slide.caption)drawCaptionCard(ctx,slide.caption,{x:W*.59,y:H-300,width:W*.36,fontSize:36,minFontSize:25,maxLines:4,background:"#f4e6d2"});
    }else if(layout==="polaroid"){
      drawCover(ctx,first,0,0,W,H,slide.image_focus);
      if(imgs[1]&&!hasProminentPerson(selected[0])){
        ctx.save();ctx.translate(W*.79,H*.23);ctx.rotate(.055);ctx.shadowColor="#0005";ctx.shadowBlur=24;ctx.fillStyle="#fffdf7";ctx.fillRect(-145,-170,290,360);ctx.shadowBlur=0;drawCover(ctx,imgs[1],-128,-153,256,285);ctx.restore();
      }
      if(slide.caption)drawCaptionCard(ctx,slide.caption,{x:42,y:H-245,width:620,fontSize:42,minFontSize:30,maxLines:3,background:"#f4dfc4"});
    }else if(layout==="collage"){
      drawCover(ctx,first,0,0,W,H,slide.image_focus);
      if(imgs[1]){ctx.save();ctx.translate(W*.68,H*.32);ctx.rotate(-.09);ctx.shadowColor="#0006";ctx.shadowBlur=25;ctx.fillStyle="#fff";ctx.fillRect(-185,-210,370,430);ctx.shadowBlur=0;drawCover(ctx,imgs[1],-168,-192,336,350);ctx.restore();}
      if(imgs[2]){ctx.save();ctx.translate(W*.25,H*.78);ctx.rotate(.07);ctx.shadowColor="#0006";ctx.shadowBlur=20;ctx.fillStyle="#fff";ctx.fillRect(-150,-165,300,345);ctx.shadowBlur=0;drawCover(ctx,imgs[2],-135,-150,270,280);ctx.restore();}
      if(slide.caption)drawCaptionCard(ctx,slide.caption,{x:48,y:H-250,width:660,fontSize:44,minFontSize:30,maxLines:3,background:"#f4e6d2"});
    }else if(layout==="note"){
      ctx.fillStyle=slide.background;ctx.fillRect(0,0,W,H);drawCover(ctx,first,45,45,W-90,H*.68,slide.image_focus);
      drawTornPanel(ctx,0,H*.70,W,H*.30,"#f4e6d2");
      if(slide.location_label)drawText(ctx,slide.location_label.toUpperCase(),75,H*.76,900,"18px 'DM Mono', monospace","#806b58","left",{maxLines:1,lineHeight:24});
      drawCaptionCard(ctx,slide.caption||slide.title,{x:42,y:H*.79,width:W-84,fontSize:48,minFontSize:32,maxLines:2,background:"#f4e6d2"});
    }else{
      drawCover(ctx,first,0,H*.28,W,H*.72,slide.image_focus);
      drawTornPanel(ctx,0,0,W,H*.38,"#f4e6d2");
      drawCaptionCard(ctx,slide.caption||slide.title,{x:52,y:62,width:W-104,fontSize:54,minFontSize:36,maxLines:2,background:"#f4e6d2"});
    }
    if(index!==0&&slide.sticker!=="none")drawSticker(ctx,slide.sticker,W-145,layout==="hero"?H*.18:180);
    if(layout!=="hero"&&layout!=="note"&&layout!=="closing"&&slide.location_label)drawText(ctx,slide.location_label.toUpperCase(),65,H-55,850,"16px 'DM Mono', monospace","#51483d","left",{maxLines:1,lineHeight:22});
    if(layout!=="hero")paperNoise(ctx);
    return canvas;
  }
  function showResults(plan,canvases){
    state.slides=canvases.map((canvas,i)=>({canvas,meta:plan.slides[i]}));
    $("slideGrid").innerHTML="";
    state.slides.forEach((slide,i)=>{
      const card=document.createElement("article");card.className="slide-card";
      const img=document.createElement("img");img.src=slide.canvas.toDataURL("image/jpeg",.9);img.alt=slide.meta.title;
      const meta=document.createElement("div");meta.className="slide-meta";
      const label=document.createElement("span");label.textContent=String(i+1).padStart(2,"0")+" · "+slide.meta.layout.toUpperCase();
      const dl=document.createElement("button");dl.textContent="↓ PNG";dl.onclick=()=>downloadCanvas(slide.canvas,"frame-slide-"+String(i+1).padStart(2,"0")+".png");
      meta.append(label,dl);card.append(img,meta);$("slideGrid").append(card);
    });
    $("resultSummary").textContent=(plan.creative_direction||"A travel story, art-directed by AI.")+" · "+state.slides.length+" slides";
    $("resultCount").textContent=state.slides.length+" SLIDES";
    $("resultsSection").hidden=false;$("resultsSection").scrollIntoView({behavior:"smooth",block:"start"});
  }
  function downloadCanvas(canvas,name){const a=document.createElement("a");a.download=name;a.href=canvas.toDataURL("image/png");a.click();}
  async function downloadZip(){
    if(!window.JSZip){toast("ZIP library is still loading. Try again in a moment.");return;}
    const zip=new JSZip();const folder=zip.folder("frame-travel-carousel");
    for(let i=0;i<state.slides.length;i++){
      const blob=await new Promise(resolve=>state.slides[i].canvas.toBlob(resolve,"image/png"));
      folder.file("slide-"+String(i+1).padStart(2,"0")+".png",blob);
    }
    const readme="FRAME / TRAVEL STUDIO\nGenerated Instagram carousel\nCanvas: 1080 x 1350 px\nSlides: "+state.slides.length+"\n\nUpload the PNG files to Instagram in numbered order.";
    folder.file("README.txt",readme);
    const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="frame-travel-carousel.zip";a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  async function generate(){
    if(state.busy)return;
    if(!window.puter?.ai?.chat){toast("Puter AI is unavailable. Refresh and try again.");return;}
    if(state.files.length<3){toast("Upload at least 3 photographs first.");return;}
    state.busy=true;updateCount();$("generateButton").textContent="Creating…";$("resultsSection").hidden=true;
    const brief={destination:$("destination").value.trim(),vibe:$("vibe").value,company:$("company").value,mood:$("mood").value,count:$("slideCount").value,text:$("textStyle").value,style:$("designStyle").value,notes:$("notes").value.trim()};
    try{
      const analyses=await analysePhotos(brief.destination,brief.vibe);
      const plan=await createStoryboard(brief,analyses);
      progress(65,"Composing the pages…","Building "+plan.slides.length+" individual slides.",2);
      const canvases=[];
      for(let i=0;i<plan.slides.length;i++){
        progress(65+Math.round((i/plan.slides.length)*34),"Composing the pages…","Rendering slide "+(i+1)+" of "+plan.slides.length+".",2);
        canvases.push(await renderSlide(plan.slides[i],i,plan));
      }
      progress(100,"Your carousel is ready.","All slides rendered. Preview below or download your ZIP.",2);
      showResults(plan,canvases);toast("Your carousel is ready!");
    }catch(error){console.error(error);toast(error.message||"Something went wrong. Please try again.");$("progressMessage").textContent=error.message||"Generation failed. Check Puter access and try again.";}
    finally{state.busy=false;$("generateButton").innerHTML="<span>✳</span> Create my carousel <span>↗</span>";updateCount();}
  }
  $("generateButton").onclick=generate;$("downloadButton").onclick=downloadZip;
  $("startOverButton").onclick=()=>{state.slides=[];$("resultsSection").hidden=true;window.scrollTo({top:0,behavior:"smooth"});};
  $("puterStatus").onclick=async()=>{
    try{if(!window.puter?.auth)throw new Error("Puter SDK is not loaded.");if(!puter.auth.isSignedIn()){await puter.auth.signIn();}toast("Connected to Puter. AI requests will use your Puter account.");$("puterStatus").textContent="Puter connected";}
    catch(e){toast("Puter connection: "+e.message);}
  };
  updateCount();
  if(window.puter?.auth?.isSignedIn?.())$("puterStatus").textContent="Puter connected";
})();