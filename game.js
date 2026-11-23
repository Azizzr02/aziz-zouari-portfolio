(() => {
  const select = selector => document.querySelector(selector);
  const canvas = select("#world");
  const context = canvas.getContext("2d");
  const terminal = select("#terminal");
  const terminalBody = select("#terminal-body");
  const inspectButton = select("#inspect");
  const nearby = select("#nearby");
  const objective = select("#objective");
  const objectiveText = select("#objective-text");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const {floor,worldWidth,height} = LabArt;
  const storeKey = "aziz-signal-lab-v1";
  const missionIds = ["bms","adas","thermal"];
  const floorStanding = {y:floor,vy:0,grounded:true,walking:false};
  const avatar = {x:102,facing:1,...floorStanding};
  const pressed = new Set();
  const touched = new Map();

  const rooms = [
    {id:"boot", name:"Boot bay", station:{x:315,label:"Briefing"}, platforms:[{x:495,y:217,w:84}],
      note:{x:594,title:"The engineer",body:"I’m Aziz Zouari, an embedded software engineer based in Sousse, Tunisia. I earned an engineering degree in Industrial Electronics at ENISo with Highest Honors in 2026. I work across STM32 firmware, Linux integration, and system validation.",href:"resume.html",link:"Education and skills"}},
    {id:"bms", name:"CAN-FD bench", station:{x:401,label:"Inspect the CAN-FD bench"},platforms:[{x:530,y:214,w:74},{x:692,y:198,w:75}],
      note:{x:599,title:"Test notes",body:"At SEGULA Technologies, I built an STM32G0B1RE BMS firmware emulator and Raspberry Pi supervisor. I wrote Python and shell tools for test execution and capture, and documented the bench setup and validation procedures.",href:"projects.html#bms",link:"Full CAN-FD case study"}},
    {id:"adas", name:"Vision tunnel", station:{x:405,label:"Inspect the vision rig"},platforms:[{x:528,y:219,w:71},{x:695,y:203,w:84}],
      note:{x:607,title:"Gateway log",body:"The Raspberry Pi 4 ran a custom Yocto image with SocketCAN. It received the perception measurements by UDP and translated them into CAN messages. The STM32F407 generated 50 Hz PWM for the motor controller.",href:"projects.html#adas",link:"Full ADAS case study"}},
    {id:"thermal", name:"Thermal bay", station:{x:404,label:"Inspect the cooling controller"},platforms:[{x:525,y:216,w:72},{x:700,y:202,w:89}],
      note:{x:606,title:"Board bring-up log",body:"I took this dual-STM32 CAN thermal monitor through schematic capture, PCB layout, assembly and bring-up. I checked temperature acquisition and PWM fan control with an oscilloscope, multimeter, and logic analyzer.",href:"projects.html#thermal",link:"Full Thermal ECU case study"}},
    {id:"finish",name:"Signal tower",station:{x:447,label:"Open the signal tower console"},platforms:[{x:540,y:218,w:63},{x:704,y:198,w:95}],
      note:{x:610,title:"Robotics record",body:"Our team placed third in the 2025 NXP Cup Tunisia. I programmed an autonomous model car in C++ and applied sensor fusion under real-time test conditions.",href:"resume.html",link:"Résumé and awards"}},
  ];

  function readSave() {
    try {
      const value = JSON.parse(localStorage.getItem(storeKey));
      const completed = missionIds.filter(id => Array.isArray(value?.completed) && value.completed.includes(id));
      const index = Number.isInteger(value?.index) && rooms[value.index] ? value.index : 0;
      const x = Number.isFinite(value?.x) ? Math.max(20,Math.min(worldWidth-20,value.x)) : 102;
      return {completed,index,x,played:value?.played===true,briefed:value?.briefed===true};
    } catch {
      return {completed:[],index:0,x:102,played:false,briefed:false};
    }
  }

  const save = readSave();
  const completed = new Set(save.completed);
  let roomIndex = 0, started = false, previousTime = 0, offset = 0, walkTarget = null;
  let targetAction = false, activeObject = null, briefed = save.briefed, boostTimer;

  function persist() {
    try {
      localStorage.setItem(storeKey,JSON.stringify({completed:[...completed],index:roomIndex,x:avatar.x,played:started,briefed}));
    } catch {
      // The game also works when browser storage is unavailable.
    }
  }

  function announce(message) {
    select("#announcement").textContent = message;
  }

  function hud() {
    const room = rooms[roomIndex];
    select("#room-number").textContent = String(roomIndex).padStart(2,"0");
    select("#room-name").textContent = room.name;
    select("#progress-label").textContent = `${completed.size} / 3 links restored`;
    document.querySelectorAll(".pips i").forEach((pip,index) => pip.classList.toggle("online",index<completed.size));
    objective.hidden = !started;
    if (started) {
      const goal = roomGoal();
      objectiveText.textContent = goal.type==="next" ? `Take the airlock to ${rooms[roomIndex+1].name}` :
        roomIndex===0 ? "Read the briefing" :
        roomIndex===4 ? "Check the tower console" : "Restore this station’s signal";
    }
  }

  function stopInput() {
    pressed.clear();
    touched.clear();
    walkTarget = null;
    targetAction = false;
    avatar.walking = false;
  }

  function enterRoom(index,x) {
    roomIndex = index;
    Object.assign(avatar,floorStanding,{x,facing:1});
    stopInput();
    activeObject = null;
    nearby.hidden = true;
    hud();
    announce(`${rooms[index].name}. ${objectiveText.textContent}.`);
    persist();
  }

  function begin() {
    if (started) return;
    select("#launch").hidden = true;
    started = true;
    const index=save.played?save.index:0;
    const resumeHere=save.played&&(index!==0||briefed);
    enterRoom(index,resumeHere?save.x:rooms[index].station.x-38);
    canvas.focus({preventScroll:true});
  }

  function roomObjects() {
    const room = rooms[roomIndex];
    const objects = [{...room.station,type:"station",pin:145}];
    if (room.note) objects.push({...room.note,type:"note",label:"Read the field log",pin:182});
    if (roomIndex>0) objects.push({x:31,type:"back",label:"Previous room",pin:156});
    if (roomIndex<rooms.length-1) objects.push({x:892,type:"next",label:roomIndex===3?"Enter the tower":"Next room",pin:156});
    return objects;
  }

  function findNearest(objects,x,radius) {
    return objects.reduce((closest,object) => {
      const distance = Math.abs(object.x-x);
      return distance <= radius && (!closest || distance < Math.abs(closest.x-x)) ? object : closest;
    },null);
  }

  function roomGoal(objects=roomObjects()) {
    if (roomIndex!==4 && (roomIndex===0 ? briefed : completed.has(rooms[roomIndex].id))) {
      return objects.find(object => object.type==="next");
    }
    return objects[0];
  }

  function actionObject() {
    const goal=roomGoal();
    return activeObject?.type==="station"&&goal.type==="next" ? goal : activeObject??goal;
  }

  function drawLocator(width) {
    activeObject = started ? findNearest(roomObjects(),avatar.x,57) : null;
    if (started) {
      const action=actionObject();
      const label=targetAction ? "Stop walking" :
        Math.abs(action.x-avatar.x)>57 ? "Go to objective" :
        action.type==="next"||action.type==="back" ? action.label : "Inspect";
      if(inspectButton.textContent!==label) inspectButton.textContent=label;
      if(inspectButton.disabled) inspectButton.disabled=false;
    }
    if (!activeObject) {
      if(!nearby.hidden) nearby.hidden=true;
      return;
    }
    const screenX = (activeObject.x-offset)/width*100;
    const offscreen = screenX < 6 || screenX > 94;
    if (nearby.hidden !== offscreen) nearby.hidden = offscreen;
    if (nearby.textContent !== activeObject.label) nearby.textContent = activeObject.label;
    const safeInset = Math.min(50,(nearby.offsetWidth / Math.max(1,canvas.clientWidth))*50+1);
    const left = `${Math.max(safeInset,Math.min(100-safeInset,screenX))}%`;
    const top = `${activeObject.pin/height*100}%`;
    if (nearby.style.left !== left) nearby.style.left = left;
    if (nearby.style.top !== top) nearby.style.top = top;
  }

  function act() {
    if(!started || terminal.open) return;
    if(targetAction){
      walkTarget=null;
      targetAction=false;
      announce("Stopped walking.");
      return;
    }
    const action=actionObject();
    if(Math.abs(action.x-avatar.x)<=57) invoke(action);
    else {
      walkTarget=action.x;
      targetAction=true;
      announce(`Walking to ${action.label.toLowerCase()}.`);
    }
    if(!terminal.open) canvas.focus({preventScroll:true});
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    canvas.width = Math.min(worldWidth,Math.max(120,Math.round(height*bounds.width/Math.max(1,bounds.height))));
    canvas.height = height;
    context.imageSmoothingEnabled = false;
  }

  function simulate(dt) {
    let walkingLeft = pressed.has("left"), walkingRight = pressed.has("right");
    for(const control of touched.values()) {
      if(control.direction==="left") walkingLeft=true;
      else walkingRight=true;
    }
    const destination = walkTarget !== null && Math.abs(walkTarget-avatar.x)>6 ? Math.sign(walkTarget-avatar.x) : 0;
    const force = Number(walkingRight)-Number(walkingLeft) || destination;
    avatar.walking = !!force && avatar.grounded;
    if (force) avatar.facing = force;
    avatar.x = Math.max(20,Math.min(worldWidth-20,avatar.x+force*178*dt));
    const previousY=avatar.y;
    avatar.vy += 580*dt;
    avatar.y += avatar.vy*dt;
    avatar.grounded = false;
    const ledge = rooms[roomIndex].platforms.find(p => avatar.x>=p.x && avatar.x<=p.x+p.w && previousY<=p.y && avatar.y>=p.y);
    const ground = ledge?.y ?? floor;
    if (avatar.y>=ground) {
      avatar.y=ground;
      avatar.vy=0;
      avatar.grounded=true;
    }
    if(walkTarget!==null && Math.abs(walkTarget-avatar.x)<=6){
      const interact = targetAction;
      walkTarget=null;
      targetAction=false;
      if (interact) invoke(findNearest(roomObjects(),avatar.x,57));
    }
  }

  function frame(now) {
    const dt = Math.min(.034,(now-(previousTime||now))/1000);
    previousTime = now;
    if (started && !terminal.open) simulate(dt);
    const room = rooms[roomIndex];
    const width = canvas.width;
    const actor = started ? avatar : {...avatar,x:Math.max(85,width*.77)};
    offset = started ? Math.max(0,Math.min(worldWidth-width,actor.x-width*.49)) : width<500 ? 140 : 0;
    if (!started && width<500) actor.x = offset+width*.78;
    LabArt.render(context,{room,index:roomIndex,width,offset,avatar:actor,online:completed.has(room.id)||(room.id==="finish"&&completed.size===3),motion:!motion.matches,time:now});
    drawLocator(width);
    requestAnimationFrame(frame);
  }

  function openTerminal(channel,title,html) {
    stopInput();
    select("#terminal-channel").textContent=channel;
    terminalBody.innerHTML=`<h2 id="terminal-title">${title}</h2>${html}`;
    if(!terminal.open) terminal.showModal();
    terminal.scrollTop=0;
    select("#close").focus({preventScroll:true});
  }

  function showMap() {
    const rows = rooms.map(({id,name},index) => {
      const state = missionIds.includes(id) ? completed.has(id) ? "Online" : "Offline" :
        id==="finish"&&completed.size===3 ? "Ready" : "";
      return `<li><button type="button" data-room="${index}"><span>${String(index).padStart(2,"0")} · ${name}</span><small>${state}</small></button></li>`;
    }).join("");
    openTerminal("WORKSHOP MAP","Mission map",`<p>Select a room to go directly to its station.</p><ol class="map-list">${rows}</ol>`);
    terminalBody.querySelectorAll("[data-room]").forEach(button => button.addEventListener("click",() => {
      const index=Number(button.dataset.room);
      begin();
      enterRoom(index,rooms[index].station.x-43);
      terminal.close();
    }));
  }

  function openRoomStation(index) {
    enterRoom(index,rooms[index].station.x-38);
    stations[rooms[index].id]();
  }

  function complete(id,feedback,message) {
    completed.add(id);
    feedback.textContent=message;
    feedback.classList.add("success");
    hud();
    persist();
    const boost = select("#boost");
    boost.textContent=completed.size===3?"All three links online":"Signal link restored";
    boost.hidden=false;
    clearTimeout(boostTimer);
    boostTimer=setTimeout(() => {boost.hidden=true;},3000);
    announce(boost.textContent);
    const section=feedback.closest(".mission");
    if (!section.querySelector("[data-continue]")) {
      const nextButton=document.createElement("button");
      nextButton.dataset.continue="";
      nextButton.type="button";
      nextButton.className="amber";
      const nextIndex=rooms.findIndex(room => missionIds.includes(room.id)&&!completed.has(room.id));
      const destination=nextIndex<0?4:nextIndex;
      nextButton.textContent=`Continue to ${rooms[destination].name}`;
      nextButton.addEventListener("click",() => openRoomStation(destination));
      const explore=document.createElement("button");
      explore.type="button";
      explore.textContent="Keep exploring";
      explore.addEventListener("click",() => terminal.close());
      const actions=document.createElement("div");
      actions.className="choices";
      actions.append(nextButton,explore);
      section.append(actions);
    }
  }

  function stationBms() {
    openTerminal("01 / CAN-FD BENCH","Decode a captured frame",`
      <p>Control: “We have a frame from the battery emulator. Decode the temperature before we route it to the dashboard.”</p>
      <p>This project joins STM32G0B1RE firmware to a Raspberry Pi supervisor over CAN-FD. The Pi decodes frames using a DBC file and streams the values to the dashboard.</p>
      <div class="episode-links"><a href="https://github.com/Azizzr02/BMS_STM32_Firmware">Firmware repo</a><a href="https://github.com/Azizzr02/RPI-dashboard">Dashboard repo</a><a href="projects.html#bms">Case study</a></div>
      <section class="mission"><h3>Set the health state</h3>
      <p class="commitment">ID 0x100 · Temperature bytes 60 04 · 72 °C</p>
      <p>Use the highest threshold reached. Warning starts at 50 °C, Critical at 70 °C, and Fault at 100 °C.</p>
      <div class="choices">${["Normal","Warning","Critical","Fault"].map(state => `<button type="button" data-state="${state}">${state}</button>`).join("")}</div>
      <p class="feedback" role="status">${completed.has("bms")?"Link already restored. You can replay the decode.":""}</p></section>`);
    const feedback=terminalBody.querySelector(".feedback");
    terminalBody.querySelectorAll("[data-state]").forEach(button => button.addEventListener("click",() => {
      if(button.dataset.state==="Critical"){
        complete("bms",feedback,"Critical is correct. 0x0460 is 1120. Apply 1120 ÷ 10 − 40 to recover 72 °C.");
      } else {
        feedback.classList.remove("success");
        feedback.textContent="Check the highest threshold that 72 °C crosses.";
      }
    }));
  }

  function stationAdas() {
    const slots = [
      {id:"gateway",label:"Yocto gateway"},
      {id:"motor",label:"STM32 motor controller"},
      {id:"vision",label:"Laptop / YOLOP"},
    ];
    const order=["vision","gateway","motor"];
    const route=[];
    openTerminal("02 / VISION TUNNEL","Patch the vision pipeline",`
      <p>Control: “Find the start of the signal. Then patch each stage in order.”</p>
      <p>Oussema and I built a prototype that turned vision measurements into motor commands. Inference ran on a laptop. The gateway and motor controller ran on embedded hardware.</p>
      <div class="episode-links"><a href="https://github.com/Azizzr02/Adas-Project">Project repo</a><a href="projects.html#adas">Case study and demo video</a></div>
      <section class="mission"><h3>Route the signal from frames to PWM</h3>
      <p>Start at the system that sees the camera frames. Then select the bridge that converts UDP to CAN. Finish at the device that drives the motor.</p>
      <div class="choices">${slots.map(slot => `<button type="button" data-node="${slot.id}">${slot.label}</button>`).join("")}</div>
      <p class="commitment" data-route>Route empty</p><button type="button" data-clear>Clear route</button>
      <p class="feedback" role="status">${completed.has("adas")?"Link already restored. You can build the route again.":""}</p></section>`);
    const feedback=terminalBody.querySelector(".feedback");
    const line=terminalBody.querySelector("[data-route]");
    const nodes=Array.from(terminalBody.querySelectorAll("[data-node]"));
    nodes.forEach(button => button.addEventListener("click",() => {
      const id=button.dataset.node;
      if(id!==order[route.length]){
        feedback.classList.remove("success");
        feedback.textContent=["Select the inference stage first.","Find the device that bridges UDP to CAN.","Finish at the PWM controller."][route.length];
        return;
      }
      route.push(id);
      button.disabled=true;
      line.textContent=route.map(node => slots.find(slot=>slot.id===node).label).join(" → ");
      if(route.length===3) complete("adas",feedback,"Route restored. The prototype’s STM32 generated 50 Hz PWM for motor control.");
      else feedback.textContent="Stage connected. Select the next device.";
    }));
    terminalBody.querySelector("[data-clear]").addEventListener("click",() => {
      route.length=0;
      nodes.forEach(button => {button.disabled=false;});
      line.textContent="Route empty";
      feedback.classList.remove("success");
      feedback.textContent="Select the first stage.";
    });
  }

  function stationThermal() {
    openTerminal("03 / THERMAL BAY","Tune the cooling loop",`
      <p>Control: “The sensor is reading hot. Set a PWM duty cycle inside the test band and apply it.”</p>
      <p>I designed and assembled a dual-STM32 thermal monitoring system with ADC temperature acquisition, CAN alerts, and PWM fan control. The test target below is part of the game.</p>
      <div class="episode-links"><a href="projects.html#thermal">Board design and bring-up notes</a></div>
      <section class="mission"><h3>Set the fan between 65% and 75%</h3>
      <label for="duty">Fan PWM duty <output id="reading" for="duty">35%</output></label>
      <input id="duty" type="range" min="0" max="100" step="5" value="35">
      <button type="button" data-apply>Apply duty cycle</button>
      <p class="feedback" role="status">${completed.has("thermal")?"Link already restored. You can retune the fan.":""}</p></section>`);
    const duty=select("#duty");
    const feedback=terminalBody.querySelector(".feedback");
    duty.addEventListener("input",() => {select("#reading").textContent=duty.value+"%";});
    terminalBody.querySelector("[data-apply]").addEventListener("click",() => {
      const value=duty.valueAsNumber;
      if(value>=65&&value<=75) complete("thermal",feedback,`Cooling link restored. Applied ${value}% PWM inside the requested band.`);
      else {
        feedback.classList.remove("success");
        feedback.textContent=value<65?"Duty is below the test band. Increase it.":"Duty is above the test band. Decrease it.";
      }
    });
  }

  function stationFinish() {
    const ready=completed.size===3;
    openTerminal("04 / SIGNAL TOWER",ready?"Workshop online":"The tower is waiting",`
      <p>${ready?"Control: “All three links are back. You traced a fault, routed vision data, and tuned a cooling loop. Signal confirmed.”":`Control: “${3-completed.size} signal ${completed.size===2?"link still needs":"links still need"} your attention. The map can take you straight there.”`}</p>
      <p>I’m interested in firmware, embedded Linux, system validation, and edge AI integration roles.</p>
      <div class="episode-links"><a href="resume.html">Read my résumé</a><a href="mailto:Aziz.zouari@eniso.u-sousse.tn">Email me</a><a href="https://www.linkedin.com/in/aziz-zouari">LinkedIn</a><a href="https://github.com/Azizzr02">GitHub</a></div>
      <div class="choices"><button id="tower-map" type="button">Mission map</button></div>`);
    select("#tower-map").addEventListener("click",showMap);
  }

  function stationBoot() {
    briefed=true;
    hud();
    persist();
    openTerminal("00 / BOOT BAY","A note from Control",`
      <p>“Aziz’s workshop is ready, but the tower has lost contact with three stations. Get them talking again and meet me at the tower.”</p>
      <p>The first signal comes from the CAN-FD bench. You can start that mission now, or walk around the Boot bay and read the field logs.</p>
      <div class="choices"><button type="button" class="amber" id="first-mission">Start the CAN-FD mission</button><button type="button" id="explore-bay">Explore the Boot bay</button></div>
      <div class="episode-links"><a href="resume.html">About Aziz</a><a href="projects.html#experience">Internships and experience</a></div>`);
    select("#first-mission").addEventListener("click",() => openRoomStation(1));
    select("#explore-bay").addEventListener("click",() => terminal.close());
  }

  const stations = {
    boot:stationBoot,
    bms:stationBms,
    adas:stationAdas,
    thermal:stationThermal,
    finish:stationFinish,
  };

  function invoke(object) {
    if (!object || terminal.open || !started) return;
    if (object.type==="next") enterRoom(roomIndex+1,92);
    else if (object.type==="back") enterRoom(roomIndex-1,worldWidth-92);
    else if (object.type==="station") stations[rooms[roomIndex].id]();
    else if (object.type==="note") openTerminal("FIELD LOG",object.title,`<p>${object.body}</p><div class="episode-links"><a href="${object.href}">${object.link}</a></div>`);
  }

  function jump() {
    if(!started || terminal.open || !avatar.grounded) return;
    avatar.vy=-225;
    avatar.grounded=false;
  }

  function keyDirection(key) {
    if(key==="arrowleft"||key==="a") return "left";
    if(key==="arrowright"||key==="d") return "right";
    return null;
  }

  window.addEventListener("keydown",event => {
    if(!started||terminal.open||event.altKey||event.ctrlKey||event.metaKey||
       event.target.closest?.("button,a,input")) return;
    const key=event.key.toLowerCase(), direction=keyDirection(key);
    if(direction){
      event.preventDefault();
      walkTarget=null;
      targetAction=false;
      pressed.add(direction);
    } else if(key===" "||key==="arrowup"||key==="w"){
      event.preventDefault();
      if(!event.repeat) jump();
    } else if(key==="e"||key==="enter"){
      event.preventDefault();
      if(!event.repeat) {
        if(activeObject&&!targetAction) invoke(activeObject);
        else act();
      }
    }
  });
  window.addEventListener("keyup",event => {
    const direction=keyDirection(event.key.toLowerCase());
    if(direction) pressed.delete(direction);
  });
  window.addEventListener("blur",stopInput);
  window.addEventListener("pagehide",() => {if(started) persist();});
  document.querySelectorAll("[data-move]").forEach(button => {
    function step() {
      walkTarget=Math.max(20,Math.min(worldWidth-20,avatar.x+(button.dataset.move==="right"?58:-58)));
      targetAction=false;
    }
    button.addEventListener("pointerdown",event => {
      if(event.button!==0) return;
      event.preventDefault();
      begin();
      canvas.focus({preventScroll:true});
      walkTarget=null;
      targetAction=false;
      touched.set(event.pointerId,{direction:button.dataset.move,startedAt:performance.now()});
      button.setPointerCapture(event.pointerId);
    });
    const release = event => {touched.delete(event.pointerId);};
    button.addEventListener("lostpointercapture",release);
    button.addEventListener("pointercancel",release);
    button.addEventListener("pointerup",event => {
      const control=touched.get(event.pointerId);
      release(event);
      if(control&&performance.now()-control.startedAt<200) step();
    });
    button.addEventListener("click",event => {
      if(event.detail===0){
        begin();
        step();
      }
    });
  });
  canvas.addEventListener("click",event => {
    if(!started||terminal.open) return;
    const bounds=canvas.getBoundingClientRect();
    const x=(event.clientX-bounds.left)/bounds.width*canvas.width+offset;
    const object=findNearest(roomObjects(),x,48);
    if(object&&Math.abs(object.x-avatar.x)<57) invoke(object);
    else {
      walkTarget=Math.max(20,Math.min(worldWidth-20,object?.x??x));
      targetAction=!!object;
    }
  });
  select("#start").addEventListener("click",() => {
    begin();
    if(roomIndex===0&&!briefed) stationBoot();
  });
  select("#map").addEventListener("click",showMap);
  select("#jump").addEventListener("click",() => {begin();jump();canvas.focus({preventScroll:true});});
  select("#close").addEventListener("click",() => terminal.close());
  terminal.addEventListener("close",() => {if(started) canvas.focus({preventScroll:true});});
  inspectButton.addEventListener("click",act);
  nearby.addEventListener("click",() => invoke(activeObject));
  nearby.addEventListener("pointerdown",event => {
    if(event.button!==0) return;
    event.preventDefault();
    invoke(activeObject);
  });
  if(save.played) {
    select("#start").textContent="Resume game";
    const remaining=3-completed.size;
    select("#launch-state").textContent=remaining===0 ? "ALL SIGNAL LINKS ONLINE" :
      `${remaining} SIGNAL LINK${remaining===1?"":"S"} OFFLINE`;
  }
  const legacy={bms:"#bms",adas:"#adas",thermal:"#thermal",projects:"#projects",experience:"#experience",contact:"#contact"};
  const destination=legacy[location.hash.slice(1)];
  if(destination&&Object.values(legacy).includes(destination)) location.replace("projects.html"+destination);
  hud();
  resize();
  new ResizeObserver(resize).observe(canvas);
  requestAnimationFrame(frame);
})();
