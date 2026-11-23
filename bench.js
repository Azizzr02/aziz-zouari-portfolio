(() => {
  const byId=id=>document.getElementById(id);
  const content=byId("station-content");
  const workspace=byId("workspace");
  const controls=Array.from(document.querySelectorAll("[data-open]"));
  const surface=byId("monitor-surface");
  const expand=byId("expand-terminal");
  const sceneArea=byId("render-area");
  const feedback=byId("feedback");
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  const desktopTyping=matchMedia("(pointer: fine) and (min-width: 741px)");
  const meterModes=["Voltage","Resistance","Continuity"];
  const timebases=[2,4,8];
  const state={powered:true,meterMode:"Voltage",point:"supply",protocol:"UART",running:true,sample:0,frequency:1000,wave:"Sine",timebase:4};
  const stations={
    display:{channel:"WORKBENCH DISPLAY",title:"Portfolio terminal"},
    meter:{channel:"DIGITAL MULTIMETER",title:"Measure the circuit",mount:meterStation},
    logic:{channel:"LOGIC ANALYZER",title:"Read the bus",mount:logicStation},
    scope:{channel:"OSCILLOSCOPE",title:"Inspect a waveform",mount:scopeStation},
    board:{channel:"STM32 PROTOTYPE",title:"Board bring-up",mount:boardStation},
  };
  let active="",returnFocus=null,focusDisplay=false;
  const cue=BenchAudio.mount(byId("sound"),feedback);
  const terminal=BenchTerminal.mount(byId("terminal-root"),{cue,leave:overview});
  const model=BenchScene.mount({area:sceneArea,markers:byId("markers"),select:open,
    surface:projectDisplay,action:hardwareControl,orbitSound:()=>cue("walk")});
  workspace.dataset.render=model?"3d":"flat";
  byId("fallback").hidden=!!model;
  byId("scene-help").hidden=!model;

  function projectDisplay(bounds) {
    surface.classList.toggle("ready",!!bounds);
    if(!bounds)return;
    ["x","y","width","height"].forEach((dimension,i)=>surface.style.setProperty("--screen-"+dimension,bounds[i]+"px"));
    if(focusDisplay){
      terminal.focus(desktopTyping.matches);
      focusDisplay=false;
    }
  }
  function setExpanded(enabled) {
    surface.classList.toggle("expanded",enabled);
    expand.setAttribute("aria-pressed",String(enabled));
    expand.textContent=enabled?"Fit to monitor":"Expand terminal";
  }
  function open(id) {
    if(!Object.hasOwn(stations,id))return;
    if(!active)returnFocus=document.activeElement;
    if(active===id&&id==="display"){terminal.focus(desktopTyping.matches);return;}
    active=id;
    const station=stations[id];
    const isDisplay=id==="display";
    workspace.dataset.station=id;
    workspace.classList.add("focused");
    byId("intro").hidden=true;
    byId("overview").hidden=false;
    expand.hidden=!isDisplay||!model;
    setExpanded(false);
    surface.hidden=!isDisplay;
    byId("station-heading").hidden=isDisplay;
    byId("channel").textContent=station.channel;
    byId("station-title").textContent=station.title;
    byId("instrument-controls").hidden=isDisplay;
    if(station.mount)station.mount();
    else content.replaceChildren();
    controls.forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.open===id)));
    focusDisplay=isDisplay;
    if(model)model.choose(id);
    else if(isDisplay){
      surface.classList.add("ready");
      terminal.focus(desktopTyping.matches);
      focusDisplay=false;
    }
    cue(id);
    feedback.textContent=isDisplay?"Opening the Linux portfolio terminal.":station.title+".";
    if(!isDisplay)sceneArea.focus({preventScroll:true});
    if(window.scrollY)window.scrollTo(0,0);
  }
  function overview() {
    if(!active)return;
    active="";
    workspace.dataset.station="overview";
    workspace.classList.remove("focused");
    surface.hidden=true;
    setExpanded(false);
    byId("instrument-controls").hidden=true;
    byId("station-heading").hidden=true;
    content.replaceChildren();
    byId("intro").hidden=false;
    byId("overview").hidden=true;
    expand.hidden=true;
    controls.forEach(button=>button.removeAttribute("aria-pressed"));
    model?.choose();
    cue("overview");
    if(returnFocus?.getClientRects().length)returnFocus.focus({preventScroll:true});
    else sceneArea.focus({preventScroll:true});
    feedback.textContent="Full workbench.";
  }
  function read(path) {
    open("display");
    terminal.read(path);
  }
  const buttons=(values,current,attr)=>`<div class="mode-tabs">${values.map(v=>`<button type="button" data-${attr}="${v}" aria-pressed="${v===current}">${v}</button>`).join("")}</div>`;
  function mark(attr,value) {
    content.querySelectorAll("[data-"+attr+"]").forEach(button=>button.setAttribute("aria-pressed",String(button.getAttribute("data-"+attr)===value)));
  }
  function choose(attr,handler) {
    content.querySelectorAll("[data-"+attr+"]").forEach(button=>button.addEventListener("click",()=>handler(button.getAttribute("data-"+attr))));
  }
  function listen(id,event,handler){byId(id).addEventListener(event,handler);}

  const points={
    supply:{name:"3.3 V supply rail",voltage:3.30,resistance:1000},
    ground:{name:"Ground return",voltage:0.00,resistance:.2},
    resistor:{name:"Isolated reference resistor",voltage:0.00,resistance:1000},
  };
  function meterReading() {
    const point=points[state.point];
    if(state.meterMode==="Voltage")return (state.powered?point.voltage:0).toFixed(2)+" V";
    if(state.powered&&state.point!=="resistor")return "LIVE";
    if(state.meterMode==="Continuity")return point.resistance<20?"BEEP":"OL";
    return point.resistance<1?point.resistance.toFixed(1)+" Ω":(point.resistance/1000).toFixed(2)+" kΩ";
  }
  function updateMeter(play=false) {
    const reading=meterReading();
    byId("meter-output").textContent=reading;
    byId("meter-note").textContent=reading==="LIVE"?"Power off before checking resistance or continuity.":
      reading==="BEEP"?"Continuity through ground return: 0.2 Ω.":reading==="OL"?"Path exceeds the simulated 20 Ω continuity threshold.":
      state.meterMode==="Voltage"?"DC voltage relative to board ground.":"Simulated resistance across the selected point.";
    byId("meter-power").textContent=state.powered?"Turn board off":"Turn board on";
    mark("meter-mode",state.meterMode);
    model?.update({meter:reading,powered:state.powered,meterMode:state.meterMode});
    if(play)cue(reading==="BEEP"?"continuity":"switch");
  }
  function meterStation() {
    content.innerHTML=`
      <div class="instrument-row">
        <div class="instrument-group"><span class="group-label">DIAL MODE</span>${buttons(meterModes,state.meterMode,"meter-mode")}</div>
        <div class="instrument-group"><label for="point">Probe location</label><select id="point">${Object.entries(points).map(([id,point])=>`<option value="${id}" ${state.point===id?"selected":""}>${point.name}</option>`).join("")}</select></div>
        <div class="instrument-readout"><small>SIMULATED READING</small><output id="meter-output" aria-live="polite"></output></div>
        <div class="instrument-actions"><button id="meter-power" type="button"></button></div>
      </div>
      <p class="instruction" id="meter-note"></p>
      <details><summary>What this tells you</summary><p>A supply measurement checks whether the board receives power. Continuity checks whether a path is connected. Click the 3D dial to cycle modes.</p><button type="button" data-file="projects/thermal-ecu.md">Read my board bring-up notes</button></details>`;
    listen("point","change",event=>{state.point=event.target.value;updateMeter(true);});
    listen("meter-power","click",()=>{state.powered=!state.powered;updateMeter(true);});
    choose("meter-mode",mode=>{state.meterMode=mode;updateMeter(true);});
    updateMeter();
  }

  function updateLogic() {
    const capture=BenchScene.logicSamples[state.protocol];
    const length=capture.rows[0][1].length;
    byId("logic-label").textContent=capture.label;
    byId("logic-note").textContent=capture.notes;
    byId("logic-value").textContent=state.running?"Live capture":
      `${state.sample+1}/${length} · ${capture.rows.map(([channel,bits])=>channel+"="+bits[state.sample]).join("  ")}`;
    mark("protocol",state.protocol);
    byId("capture").textContent=state.running?"Hold capture":"Run capture";
    byId("capture").setAttribute("aria-pressed",String(state.running));
    byId("next-sample").disabled=state.running;
    model?.update({protocol:state.protocol,running:state.running,sample:state.sample});
    const plot=byId("logic-plot");
    if(plot)BenchScene.paintLogic(plot.getContext("2d"),plot.width,plot.height,state,0);
  }
  function logicStation() {
    content.innerHTML=`
      ${!model?'<canvas class="preview-plot" id="logic-plot" width="480" height="260" role="img" aria-label="Illustrative digital timing diagram"></canvas>':""}
      <div class="instrument-row">
        <div class="instrument-group"><span class="group-label">PROTOCOL</span>${buttons(["UART","SPI"],state.protocol,"protocol")}</div>
        <div class="instrument-actions"><button type="button" id="capture"></button><button type="button" id="next-sample">Step sample</button></div>
        <div class="instrument-readout"><small id="logic-label"></small><output id="logic-value" aria-live="polite"></output></div>
      </div>
      <details><summary>Decode the capture</summary><p id="logic-note"></p><p>Hold the capture to step through individual samples. The orange button on the instrument also toggles capture.</p><button type="button" data-file="projects/bare-metal-stm32.md">Read my STM32 driver notes</button></details>`;
    listen("capture","click",()=>hardwareControl("capture"));
    listen("next-sample","click",()=>{
      const count=BenchScene.logicSamples[state.protocol].rows[0][1].length;
      state.sample=(state.sample+1)%count;
      updateLogic();
      cue("key");
    });
    choose("protocol",protocol=>{state.protocol=protocol;state.sample=0;updateLogic();cue("switch");});
    updateLogic();
  }

  function updateScope() {
    byId("freq-output").textContent=state.frequency+" Hz";
    byId("frequency").value=state.frequency;
    byId("timebase").value=state.timebase;
    byId("period").textContent=(1000/state.frequency).toFixed(2)+" ms";
    byId("scope-note").textContent=`${(state.frequency*state.timebase/1000).toFixed(1)} cycles across the ${state.timebase} ms window. The knobs on the model also change the settings.`;
    mark("wave",state.wave);
    model?.update({frequency:state.frequency,wave:state.wave,timebase:state.timebase});
    const plot=byId("scope-plot");
    if(plot)BenchScene.paintScope(plot.getContext("2d"),plot.width,plot.height,state);
  }
  function scopeStation() {
    const range=timebases.map(value=>`<option value="${value}">${value} ms</option>`).join("");
    content.innerHTML=`
      ${!model?'<canvas class="preview-plot" id="scope-plot" width="480" height="260" role="img" aria-label="Simulated signal generator waveform"></canvas>':""}
      <div class="instrument-row">
        <div class="instrument-group"><span class="group-label">SIGNAL GENERATOR</span>${buttons(["Sine","Square"],state.wave,"wave")}</div>
        <div class="instrument-group frequency"><label for="frequency">Frequency <output id="freq-output"></output></label><input id="frequency" type="range" min="100" max="3000" step="100" value="${state.frequency}"></div>
        <div class="instrument-group"><label for="timebase">Time window</label><select id="timebase">${range}</select></div>
        <div class="instrument-readout"><small>SIMULATED PERIOD</small><output id="period"></output></div>
      </div>
      <details><summary>Read the waveform</summary><p id="scope-note"></p><button type="button" data-file="skills/linux-and-validation.md">Read my validation notes</button></details>`;
    listen("frequency","input",event=>{state.frequency=event.target.valueAsNumber;updateScope();});
    listen("frequency","change",()=>cue("switch"));
    listen("timebase","change",event=>{state.timebase=Number(event.target.value);updateScope();cue("switch");});
    choose("wave",wave=>{state.wave=wave;updateScope();cue("switch");});
    updateScope();
  }

  function updateBoard() {
    byId("board-output").textContent=state.powered?"3.3 V · ON":"0.0 V · OFF";
    byId("rail").textContent=state.powered?"Turn board off":"Turn board on";
    model?.update({powered:state.powered,meter:meterReading()});
  }
  function boardStation() {
    content.innerHTML=`
      <div class="instrument-row">
        <div class="instrument-readout"><small>SIMULATED BOARD SUPPLY</small><output id="board-output" aria-live="polite"></output></div>
        <div class="instrument-actions"><button type="button" id="rail"></button><button type="button" id="check-rail">Measure the supply</button><button type="button" data-file="projects/can-fd-test-bench.md">Open the firmware case study</button></div>
      </div>
      <p class="instruction">Click the small amber switch on the PCB to change the rail and watch the status LED.</p>`;
    listen("rail","click",()=>hardwareControl("power"));
    listen("check-rail","click",()=>{state.meterMode="Voltage";state.point="supply";open("meter");});
    updateBoard();
  }

  const cycle=(values,value)=>values[(values.indexOf(value)+1)%values.length];
  function hardwareControl(control) {
    if(control==="meter-mode"&&active==="meter"){
      state.meterMode=cycle(meterModes,state.meterMode);
      updateMeter(true);
    }else if(control==="capture"&&active==="logic"){
      if(state.running&&!reduced.matches)state.sample=BenchScene.sampleAt(state.protocol,performance.now());
      state.running=!state.running;
      updateLogic();
      cue("switch");
    }else if(control==="power"&&active==="board"){
      state.powered=!state.powered;
      updateBoard();
      cue("switch");
    }else if(active==="scope"){
      if(control==="frequency")state.frequency=state.frequency>=3000?100:state.frequency+100;
      else if(control==="timebase")state.timebase=cycle(timebases,state.timebase);
      else if(control==="wave")state.wave=state.wave==="Sine"?"Square":"Sine";
      updateScope();
      cue("switch");
    }
  }

  controls.forEach(button=>button.addEventListener("click",()=>open(button.dataset.open)));
  content.addEventListener("click",event=>{
    const file=event.target.closest("[data-file]");
    if(file)read(file.dataset.file);
  });
  listen("overview","click",overview);
  expand.addEventListener("click",()=>{
    setExpanded(expand.getAttribute("aria-pressed")!=="true");
    terminal.focus();
    cue("switch");
  });
  window.addEventListener("keydown",event=>{
    if(event.key!=="Escape"||!active)return;
    if(active==="display"&&terminal.closeReader())return;
    if(active==="display"&&surface.classList.contains("expanded")){setExpanded(false);return;}
    overview();
  });
  const hash=location.hash.slice(1);
  if(["bms","adas","thermal","projects","experience","contact"].includes(hash))location.replace("projects.html#"+hash);
  else if(hash==="terminal")open("display");
  else if(Object.hasOwn(stations,hash))open(hash);
})();
