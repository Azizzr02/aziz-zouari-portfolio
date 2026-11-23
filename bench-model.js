const BenchScene = (() => {
  const uart=[1,0,1,0,1,0,1,0,1,0,1,1];
  const spi=[1,0,1,0,0,1,0,1];
  const logicSamples={
    UART:{
      label:"UART 8N1 · 0x55",
      notes:"A low start bit, eight data bits sent least-significant bit first, then a high stop bit. TX and RX have no separate clock.",
      rows:[["TX",uart],["RX",uart.map(()=>1)]],
    },
    SPI:{
      label:"SPI mode 0 · 0xA5",
      notes:"CS goes low for the transfer. MOSI is stable before each rising SCLK edge, where the receiver samples the data.",
      rows:[["SCLK",[0,0,...spi.flatMap(()=>[0,1]),0,0]],["MOSI",[0,0,...spi.flatMap(bit=>[bit,bit]),0,0]],
        ["CS",[1,1,...spi.flatMap(()=>[0,0]),0,1]]],
    },
  };
  const sweepDuration=3300;
  const sweepPosition=time=>(time%sweepDuration)/sweepDuration;
  const sampleAt=(protocol,time)=>Math.floor(sweepPosition(time)*logicSamples[protocol].rows[0][1].length);
  const screenFont='"IBM Plex Mono", Consolas, monospace';
  function paintGrid(ctx,w,h,top) {
    ctx.fillStyle="#242622";ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="#54564b";ctx.lineWidth=1;
    for(let i=0;i<=10;i++){ctx.beginPath();ctx.moveTo(i*w/10,top);ctx.lineTo(i*w/10,h);ctx.stroke();}
    for(let i=0;i<=6;i++){
      const y=top+i*(h-top)/6;
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();
    }
  }
  function paintLogic(ctx,w,h,{protocol,running,sample},time) {
    const data=logicSamples[protocol];
    const top=48,left=65,traceWidth=w-76;
    paintGrid(ctx,w,h,top);
    ctx.font=`600 21px ${screenFont}`;
    ctx.fillStyle="#ebe0bb";
    ctx.fillText(data.label+"   "+(running?"RUN":"HOLD"),14,30);
    const colors=["#f0cc7f","#d6d9c7","#a8bfd0"];
    data.rows.forEach(([label,bits],row)=>{
      const height=(h-top-9)/data.rows.length;
      const y0=top+(row+.78)*height;
      const step=traceWidth/bits.length;
      ctx.font=`600 18px ${screenFont}`;ctx.fillStyle=colors[row];ctx.strokeStyle=colors[row];ctx.lineWidth=3;
      ctx.fillText(label,8,y0-6);
      ctx.beginPath();
      let last=y0-bits[0]*height*.43;
      ctx.moveTo(left,last);
      bits.forEach((bit,i)=>{
        const x=left+i*step,y=y0-bit*height*.43;
        ctx.lineTo(x,last);ctx.lineTo(x,y);ctx.lineTo(x+step,y);last=y;
      });
      ctx.stroke();
    });
    const n=data.rows[0][1].length;
    const x=left+(running?sweepPosition(time):((sample%n+.5)/n))*traceWidth;
    ctx.strokeStyle="#d98d69";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,h);ctx.stroke();
  }
  function paintScope(ctx,w,h,{frequency,wave,timebase}) {
    const top=43;
    paintGrid(ctx,w,h,top);
    ctx.font=`600 20px ${screenFont}`;ctx.fillStyle="#ede1c0";
    ctx.fillText(frequency+" Hz  /  "+wave.toUpperCase()+"  /  "+timebase+" ms",14,29);
    ctx.strokeStyle="#efc87a";ctx.lineWidth=4;ctx.beginPath();
    for(let x=0;x<=w;x++){
      const sine=Math.sin(x/w*Math.PI*2*frequency*timebase/1000);
      const y=(top+h)/2-(wave==="Square"?Math.sign(sine):sine)*(h-top)*.32;
      if(x)ctx.lineTo(x,y);else ctx.moveTo(0,y);
    }
    ctx.stroke();
  }

  function mount({area, markers, select, surface, action, orbitSound}) {
    const T=window.THREE;
    if(!T) return null;
    let renderer;
    try {renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:"low-power"});}
    catch {return null;}
    const scene=new T.Scene();
    renderer.setClearColor(0x000000,0);
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate=false;
    renderer.shadowMap.needsUpdate=true;
    renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.12;
    renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden","true");
    area.append(renderer.domElement);

    const camera=new T.PerspectiveCamera(39,1,.04,95);
    const materials=new Map();
    const pickables=[];
    const deviceAnchors={};
    let state={powered:true,wave:"Sine",frequency:1000,timebase:4,meter:"3.30 V",meterMode:"Voltage",protocol:"UART",running:true,sample:0};

    const material=(color,metalness=0,emissive=0) => {
      const key=[color,metalness,emissive].join(",");
      if(!materials.has(key)) materials.set(key,new T.MeshStandardMaterial({
        color,metalness,roughness:metalness>.3?.33:.64,emissive:emissive?color:0,emissiveIntensity:emissive,
      }));
      return materials.get(key);
    };
    const m=(geometry,color,x,y,z,parent=scene,metal=0,emission=0) => {
      const object=new T.Mesh(geometry,typeof color==="string"?material(color,metal,emission):color);
      object.position.set(x,y,z);
      object.castShadow=true;
      object.receiveShadow=true;
      parent.add(object);
      return object;
    };
    const box=(parent,x,y,z,w,h,d,color,metal=0)=>m(new T.BoxGeometry(w,h,d),color,x,y,z,parent,metal);
    function rounded(parent,x,y,z,w,h,d,color,r=.04) {
      const s=new T.Shape();
      const a=w/2-r,b=h/2-r;
      s.moveTo(-a,-b);s.lineTo(a,-b);s.lineTo(a,b);s.lineTo(-a,b);s.closePath();
      const geometry=new T.ExtrudeGeometry(s,{depth:Math.max(.005,d-r*2),bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:2,curveSegments:1});
      geometry.translate(0,0,-Math.max(.005,d-r*2)/2);
      return m(geometry,color,x,y,z,parent);
    }
    const sphere=(parent,x,y,z,sx,sy,sz,color) => {
      const ball=m(new T.SphereGeometry(1,20,14),color,x,y,z,parent);
      ball.scale.set(sx,sy,sz);
      return ball;
    };
    const cylinder=(parent,x,y,z,r1,r2,h,color,segments=22,metal=0)=>m(new T.CylinderGeometry(r1,r2,h,segments),color,x,y,z,parent,metal);
    const vector=values=>new T.Vector3(...values);
    function beam(parent,from,to,r1,r2,color,metal=0) {
      const a=vector(from),b=vector(to),delta=b.clone().sub(a),mid=a.add(b).multiplyScalar(.5);
      const rod=cylinder(parent,...mid.toArray(),r1,r2,delta.length(),color,14,metal);
      rod.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
      return rod;
    }
    function cable(points,r,color,parent=scene) {
      return m(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(vector)),25,r,7,false),color,0,0,0,parent);
    }
    function group(x,y,z,id) {
      const object=new T.Group();
      object.position.set(x,y,z);
      scene.add(object);
      if(id){object.userData.device=id;pickables.push(object);}
      return object;
    }
    function screen(parent,x,y,z,w,h,rotation=0) {
      const canvas=document.createElement("canvas");
      canvas.width=480;canvas.height=260;
      const context=canvas.getContext("2d");
      const texture=new T.CanvasTexture(canvas);
      texture.colorSpace=T.SRGBColorSpace;
      const mesh=m(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture}),x,y,z,parent);
      mesh.rotation.x=rotation;
      mesh.castShadow=false;
      return {context,texture,mesh,w:canvas.width,h:canvas.height};
    }
    function annotate(id,x,y,z) {deviceAnchors[id]=[x,y,z];}

    // Stage lighting and contact shadows.
    const floor=m(new T.PlaneGeometry(80,80),new T.ShadowMaterial({opacity:.30}),0,.005,0);
    floor.rotation.x=-Math.PI/2;
    floor.castShadow=false;
    const grid=new T.GridHelper(52,52,0x8b8a81,0x8b8a81);
    grid.material.transparent=true;grid.material.opacity=.19;
    scene.add(grid);
    scene.add(new T.HemisphereLight(0xf6f4eb,0x69584c,2.08));
    const key=new T.DirectionalLight(0xffebd3,2.85);
    key.position.set(-4,10,6);
    key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);
    key.shadow.camera.left=-8;key.shadow.camera.right=8;
    key.shadow.camera.top=8;key.shadow.camera.bottom=-8;
    key.shadow.bias=-.00035;key.shadow.normalBias=.025;
    scene.add(key);
    const rim=new T.DirectionalLight(0xd5dce8,1.0);
    rim.position.set(6,6,-5);
    scene.add(rim);

    // Work table, storage, and a rubber ESD mat.
    const desk=group(0,0,0);
    rounded(desk,0,2.42,0,9.8,.32,4.55,"#745b47",.065);
    box(desk,0,2.48,2.27,9.72,.052,.045,"#a69076");
    for(const x of [-4.45,4.45]) {
      for(const z of [-1.84,1.84]) box(desk,x,1.12,z,.22,2.18,.23,"#42464a",.38);
      box(desk,x,1.64,0,.16,.09,3.77,"#42484b",.38);
    }
    box(desk,0,.46,-1.65,8.67,.22,.18,"#434448",.3);
    rounded(desk,3.65,1.35,-.26,1.42,1.69,3.07,"#5d5d5b",.048);
    for(let i=0;i<3;i++){
      rounded(desk,3.65,1.88-i*.48,1.30,1.27,.42,.11,"#757471");
      box(desk,3.65,1.91-i*.48,1.38,.40,.06,.065,"#242f30",.35);
    }
    box(desk,-1.56,2.599,.63,4.91,.07,2.75,"#454d57");
    box(desk,-1.56,2.635,1.94,4.88,.008,.027,"#89919a");
    for(let i=0;i<11;i++) box(desk,-3.84+i*.42,2.634,1.85,.10,.01,.014,"#868b90");

    // Component organiser, task lamp, reel, probes, and bench tools.
    const wall=group(-3.71,2.61,-1.43);
    rounded(wall,0,.51,0,1.72,1.03,.62,"#565654");
    for(let row=0;row<3;row++) for(let col=0;col<4;col++) {
      const x=(col-1.5)*.39,y=.24+row*.27;
      rounded(wall,x,y,.338,.34,.226,.08,row===2?"#777672":"#7c7b75",.018);
      box(wall,x,y-.03,.392,.18,.03,.035,"#aca99f",.28);
    }
    const lamp=group(-4.11,2.61,.79);
    cylinder(lamp,0,.044,0,.32,.36,.085,"#844939");
    beam(lamp,[0,.08,0],[.08,1.03,-.14],.053,.06,"#a75a43",.18);
    beam(lamp,[.08,1.03,-.14],[.58,1.6,-.37],.048,.057,"#a75a43",.18);
    sphere(lamp,.08,1.03,-.14,.095,.095,.095,"#95523d");
    const lampShade=cylinder(lamp,.72,1.53,-.36,.17,.33,.26,"#9d533f");
    lampShade.rotation.z=.27;
    cylinder(lamp,.75,1.39,-.36,.234,.26,.03,"#ffd8a1",24);
    const taskLight=new T.PointLight(0xffd5a1,7,4,2);
    taskLight.position.set(-3.32,3.87,.43);scene.add(taskLight);
    const reel=group(-3.67,2.65,-.42);
    cylinder(reel,0,.035,0,.22,.22,.07,"#ad6746");
    cylinder(reel,0,.12,0,.16,.16,.17,"#b4ac91",24,.3);
    cylinder(reel,0,.218,0,.22,.22,.05,"#d39a6c");
    cylinder(reel,0,.249,0,.05,.05,.015,"#433a35");
    const tray=group(4.05,2.59,-1.25);
    rounded(tray,0,.09,0,.87,.17,.84,"#303b40");
    for(let i=0;i<5;i++){
      box(tray,-.27+i*.135,.19,-.11+(i%2)*.20,.08,.08,.26,i%2?"#bf8056":"#97a4a0");
    }
    const notebook=group(.4,2.61,1.67);
    notebook.rotation.y=-.19;
    rounded(notebook,0,.035,0,1.1,.07,.65,"#b79870",.018);
    box(notebook,0,.081,0,1.03,.019,.6,"#d5c2a0");
    for(let i=0;i<6;i++) box(notebook,-.10,.093,-.235+i*.09,.68,.006,.009,"#a49178");
    beam(desk,[1.36,2.65,1.68],[1.79,2.65,1.62],.037,.043,"#aa6448");
    beam(desk,[1.79,2.65,1.62],[1.96,2.65,1.60],.009,.032,"#b7c3b5",.48);

    const monitor=group(-.4,2.60,-1.35,"display");
    box(monitor,0,.055,0,1.53,.11,.94,"#464746");
    box(monitor,0,.42,-.11,.22,.68,.18,"#51504c");
    rounded(monitor,0,1.20,0,2.88,1.81,.36,"#a19e91",.066);
    rounded(monitor,0,1.227,.194,2.62,1.55,.059,"#3b3b35",.022);
    const display=screen(monitor,0,1.23,.226,2.43,1.42);
    box(monitor,1.04,.41,.188,.07,.025,.024,"#e2c486");
    annotate("display",-.4,4.79,-1.1);

    const scope=group(2.63,2.60,-1.08,"scope");
    rounded(scope,0,.64,0,2.55,1.21,1.02,"#87877f",.058);
    rounded(scope,0,.64,.524,2.41,1.08,.053,"#393a34",.024);
    const scopeScreen=screen(scope,-.33,.69,.553,1.51,.80);
    for(const [x,y,r,control] of [[.76,.94,.119,"frequency"],[.76,.57,.091,"timebase"],[1.05,.59,.072,"wave"]]){
      const knob=cylinder(scope,x,y,.58,r,r,.11,"#c8c2af",19);
      knob.rotation.x=Math.PI/2;
      knob.userData.control=control;
    }
    for(let i=0;i<4;i++) box(scope,.43+i*.16,.245,.571,.09,.08,.055,i===0?"#c67a47":"#999c93");
    for(let i=0;i<8;i++) box(scope,-.89+i*.22,1.256,-.19,.093,.014,.39,"#4e4e46");
    annotate("scope",2.66,4.02,-.87);

    const meter=group(.01,2.64,.82,"meter");
    meter.rotation.y=-.24;
    rounded(meter,0,.165,0,.78,.31,1.24,"#c68048",.057);
    rounded(meter,0,.33,0,.645,.041,1.08,"#424845",.018);
    const meterScreen=screen(meter,0,.356,-.30,.54,.35,-Math.PI/2);
    const meterDial=new T.Group();
    meterDial.position.set(0,.389,.139);
    meterDial.userData.control="meter-mode";
    meter.add(meterDial);
    cylinder(meterDial,0,0,0,.162,.172,.071,"#202f34");
    box(meterDial,-.09,.034,-.027,.109,.018,.032,"#e0b878");
    for(const [x,color] of [[-.19,"#984945"],[.19,"#202b33"]]) cylinder(meter,x,.354,.437,.047,.047,.028,color);
    annotate("meter",.027,3.12,1.16);

    const logic=group(2.15,2.60,.91,"logic");
    rounded(logic,0,.14,0,1.34,.28,.81,"#484f57",.04);
    const logicScreen=screen(logic,-.11,.297,-.045,1.02,.52,-Math.PI/2);
    const captureSwitch=rounded(logic,.504,.287,.205,.19,.055,.12,"#e6aa68",.013);
    captureSwitch.userData.control="capture";
    for(let i=0;i<5;i++) box(logic,-.46+i*.187,.151,.442,.081,.085,.065,"#bcba91");
    annotate("logic",2.28,3.02,1.10);

    const board=group(-2.17,2.665,.91,"board");
    board.rotation.y=.13;
    box(board,0,.032,0,1.72,.064,1.14,"#506d55");
    box(board,-.11,.108,.041,.46,.11,.44,"#263036");
    box(board,-.70,.124,-.12,.24,.15,.48,"#b2bbae",.52);
    box(board,.73,.114,0,.21,.135,.39,"#c7a067");
    const led=m(new T.SphereGeometry(.043,12,9),"#efba62",.40,.12,.32,board,0,1.4);
    const power=cylinder(board,.60,.112,-.35,.064,.064,.055,"#e6aa68");
    power.userData.control="power";
    for(let i=0;i<6;i++) {
      for(const z of [-.46,.46]) box(board,-.55+i*.205,.079,z,.094,.025,.074,"#d0ac69",.20);
      for(const z of [-.237,.313]) box(board,-.265+i*.061,.075,z,.029,.025,.086,"#b3c2b6",.18);
    }
    for(let i=0;i<4;i++){
      box(board,.27+i*.096,.085,-.28,.056,.036,.10,i%2?"#95a59d":"#d0b785");
      box(board,.22+i*.124,.066,-.12+i*.047,.31,.009,.017,"#7c9574");
    }
    for(const x of [-.75,.75]) for(const z of [-.47,.47]) cylinder(board,x,.073,z,.049,.049,.024,"#d1aa66",12,.2);
    annotate("board",-2.17,3.10,.50);

    cable([[.12,2.965,1.20],[.25,2.69,1.62],[-.37,2.67,1.99],[-1.39,2.68,1.58],[-1.53,2.76,1.23]],.027,"#bc6556");
    cable([[-.19,2.965,1.18],[-.28,2.69,1.5],[-.8,2.67,1.76],[-1.60,2.69,1.56],[-1.73,2.74,1.32]],.023,"#253338");
    for(let i=0;i<4;i++) cable([[1.70+i*.18,2.76,1.35],[1.57+i*.18,2.64,1.50],[.90+i*.03,2.64,1.45],[.63+i*.07,2.68,.44]],.015,["#a26659","#c4a26a","#789a8b","#5d7590"][i]);
    cable([[3.14,2.91,-.51],[3.23,2.67,-.02],[3.05,2.66,.3],[2.67,2.73,.57]],.031,"#343c41");

    // Seated engineer. The hands reach over the mat and the iron moves at the wrist.
    const chair=group(-2.77,0,2.99);
    rounded(chair,0,1.20,.04,1.53,.25,1.31,"#636161",.08);
    rounded(chair,0,1.98,.71,1.46,1.28,.25,"#5b5b59",.082);
    cylinder(chair,0,.62,.11,.106,.13,.92,"#465250",22,.34);
    for(let i=0;i<5;i++){
      const a=i*Math.PI*2/5;
      const end=[Math.cos(a)*.81,.20,.11+Math.sin(a)*.81];
      beam(chair,[0,.35,.11],end,.066,.07,"#475555",.24);
      sphere(chair,end[0],.096,end[2],.105,.095,.10,"#2d3a40");
    }
    const human=group(-2.77,0,2.87);
    human.rotation.y=-.38;
    sphere(human,0,1.48,-.04,.57,.25,.43,"#405564");
    for(const x of [-.34,.32]){
      beam(human,[x,1.5,-.043],[x*1.21,1.30,-.79],.205,.24,"#445c66");
      beam(human,[x*1.21,1.30,-.79],[x*1.25,.29,-.92],.153,.19,"#405563");
      const shoe=sphere(human,x*1.25,.16,-1.08,.19,.14,.37,"#263238");
      shoe.rotation.y=x*.3;
    }
    const jacket=sphere(human,0,2.09,-.23,.59,.70,.357,"#4c5360");
    jacket.rotation.x=-.19;
    sphere(human,0,2.43,-.30,.60,.29,.326,"#515865");
    box(human,0,2.19,.091,.032,.70,.023,"#474b54");
    for(const x of [-.4,.4]) {
      const shoulder=sphere(human,x,2.42,-.33,.257,.238,.27,"#535964");
      shoulder.rotation.z=x;
    }
    cylinder(human,.045,2.66,-.43,.155,.18,.36,"#ba8266");
    const head=new T.Group();
    head.position.set(.065,2.98,-.51);head.rotation.x=.28;head.rotation.y=-.14;human.add(head);
    sphere(head,0,0,0,.298,.36,.278,"#ca9778");
    const hair=m(new T.SphereGeometry(1,24,16,0,Math.PI*2,0,Math.PI*.63),"#322b2c",0,.055,.030,head);
    hair.scale.set(.308,.328,.281);
    sphere(head,.283,-.039,-.015,.068,.10,.048,"#c68d72");
    sphere(head,-.282,-.039,-.015,.063,.088,.048,"#c68d72");
    sphere(head,.005,-.052,-.261,.072,.073,.085,"#c69073");
    for(const x of [-.105,.105]) sphere(head,x,.015,-.258,.031,.019,.02,"#302f2b");
    beam(head,[-.213,.05,-.223],[.222,.05,-.223],.011,.011,"#3b4542");
    for(const [side,x,end] of [[-1,-.49,[-.33,2.69,-1.67]],[1,.51,[.47,2.77,-1.56]]]){
      const elbow=[x*1.40,2.32,-.65];
      const wrist=[end[0]+side*.04,end[1]-.031,end[2]+.20];
      beam(human,[x,2.44,-.35],elbow,.161,.198,"#49535f");
      beam(human,elbow,wrist,.126,.159,"#5c6470");
      sphere(human,...end,.115,.075,.161,"#cf9a7d");
    }
    const iron=new T.Group();
    iron.position.set(.47,2.765,-1.64);human.add(iron);
    beam(iron,[0,.025,.085],[0,-.037,-.14],.047,.043,"#364c50");
    beam(iron,[0,-.038,-.14],[0,-.11,-.41],.011,.031,"#aebbb2",.61);
    iron.traverse(mesh=>{mesh.castShadow=false;});

    function raster(drawable,paint) {
      const {context:ctx,texture,w,h}=drawable;
      ctx.fillStyle="#252622";ctx.fillRect(0,0,w,h);
      paint(ctx,w,h);
      texture.needsUpdate=true;
    }
    function font(ctx,size,color="#e5dbbb") {
      ctx.fillStyle=color;
      ctx.font=`600 ${size}px ${screenFont}`;
    }
    const digital=(time=0)=>raster(logicScreen,(ctx,w,h)=>paintLogic(ctx,w,h,state,time));
    const analog=()=>raster(scopeScreen,(ctx,w,h)=>paintScope(ctx,w,h,state));
    const powerLight=()=>{led.material=material(state.powered?"#efba62":"#6f5d3d",0,state.powered?1.4:0);};
    function meterReadout() {
      raster(meterScreen,(ctx,w,h)=>{
        ctx.fillStyle="#c1bca4";ctx.fillRect(0,0,w,h);
        font(ctx,25,"#444539");ctx.fillText(state.meterMode.toUpperCase(),26,58);
        font(ctx,83,"#2c3028");ctx.fillText(state.meter,24,164);
        font(ctx,21,"#444539");ctx.fillText("BENCH METER",26,218);
      });
      meterDial.rotation.y=({Voltage:-.38,Resistance:1.14,Continuity:2.64})[state.meterMode];
    }
    function drawDisplay(preview) {
      raster(display,(ctx,w)=>{
        if(!preview)return;
        ctx.fillStyle="#43443c";ctx.fillRect(0,0,w,40);
        font(ctx,17);ctx.fillText("aziz@bench / Linux portfolio",18,28);
        font(ctx,22,"#ecd392");ctx.fillText("aziz@bench:~$ ls",20,91);
        font(ctx,21);ctx.fillText("about/    experience/    projects/",20,131);
        ctx.fillText("skills/   contact/       README.md",20,162);
        font(ctx,22,"#ecd392");ctx.fillText("aziz@bench:~$",20,215);
        ctx.fillRect(200,194,15,24);
      });
    }
    drawDisplay(true);
    meterReadout();
    digital();
    analog();
    powerLight();

    const reduced=matchMedia("(prefers-reduced-motion: reduce)");
    const anchor=new T.Vector3();
    const from=new T.Vector3();
    const projection=new T.Vector3();
    const spherical=new T.Spherical();
    const goalTarget=new T.Vector3();
    const cameraTarget=new T.Vector3();
    const cameraPosition=new T.Vector3();
    const eye=new T.Vector3();
    const shots={
      display:{target:[-.4,3.83,-1.124],direction:[0,0,1],size:[2.43,1.42]},
      meter:{target:[.025,2.91,.83],direction:[.19,1,.47],size:[.95,1.37]},
      logic:{target:[2.12,2.79,.93],direction:[.07,1,.49],size:[1.56,.95]},
      scope:{target:[2.62,3.27,-.51],direction:[.12,.26,1],size:[2.70,1.35]},
      board:{target:[-2.12,2.72,.91],direction:[.33,1,.51],size:[1.91,1.35]},
    };
    const surfaceA=new T.Vector3(),surfaceB=new T.Vector3();
    let active="",width=1,height=1,drag=null,lastSurface="",dirtyView=true;
    let pendingFrame=0,idleTimer=0,last=0,lastDigital=0;
    function schedule() {
      clearTimeout(idleTimer);
      if(!pendingFrame&&!document.hidden)pendingFrame=requestAnimationFrame(render);
    }
    function resize(){
      const rect=area.getBoundingClientRect();
      width=Math.max(1,rect.width);height=Math.max(1,rect.height);
      const ratio=Math.min(devicePixelRatio||1,width<=740?1.25:1.5);
      if(ratio!==renderer.getPixelRatio())renderer.setPixelRatio(ratio);
      renderer.setSize(width,height,false);
      camera.aspect=width/height;
      const x=!active&&width>740?-width*.13:0;
      const y=active&&active!=="display"?height*(width<=740?.13:.103):
        width<=740?height*(active==="display"?.10:-.20):0;
      camera.setViewOffset(width,height,x,y,width,height);
      camera.updateProjectionMatrix();
    }
    function pose(){
      const shot=shots[active];
      if(!shot){
        const target=[-.04,1.96,.32];
        if(width<=740)return [target,[10.55,8.8,15.26]];
        const distance=1+Math.max(0,960-width)*.00062;
        return [target,[7.9,6.85,11.75].map((axis,i)=>target[i]+(axis-target[i])*distance)];
      }
      const [w,h]=shot.size;
      const vertical=2*Math.tan(camera.fov*Math.PI/360);
      const displayView=active==="display";
      const fillWidth=displayView?(width<=740?.90:.84):.80;
      const fillHeight=displayView?.735:(width<=740?.49:.65);
      const distance=Math.max(w/(vertical*camera.aspect*fillWidth),h/(vertical*fillHeight));
      return [shot.target,from.set(...shot.direction).normalize().multiplyScalar(distance).add(eye.set(...shot.target)).toArray()];
    }
    function choose(id="",jump=false) {
      if((id==="display")!==(active==="display"))drawDisplay(id!=="display");
      active=id;
      lastSurface="";
      surface(null);
      resize();
      const [target,position]=pose();
      goalTarget.set(...target);
      spherical.setFromVector3(from.set(...position).sub(goalTarget));
      if(jump||reduced.matches) {
        cameraTarget.copy(goalTarget);
        cameraPosition.set(...position);
      }
      markers.classList.toggle("ready",!id);
      dirtyView=true;
      schedule();
    }
    const observer=new ResizeObserver(()=>choose(active));
    observer.observe(area);
    choose("",true);

    const ray=new T.Raycaster();
    const pointer=new T.Vector2();
    function deviceAt(event) {
      const bounds=area.getBoundingClientRect();
      pointer.set((event.clientX-bounds.left)/width*2-1,1-(event.clientY-bounds.top)/height*2);
      ray.setFromCamera(pointer,camera);
      const hit=ray.intersectObjects(pickables,true)[0];
      let node=hit?.object;
      let control;
      while(node&&!node.userData.device) {
        control??=node.userData.control;
        node=node.parent;
      }
      return node?{device:node.userData.device,control}:null;
    }
    function orbit(dx,dy) {
      if(active==="display")return;
      spherical.theta+=dx;
      spherical.phi=Math.max(.31,Math.min(1.48,spherical.phi+dy));
      dirtyView=true;
      schedule();
    }
    area.addEventListener("pointerdown",event=>{
      if(event.button!==0||!event.isPrimary)return;
      area.focus({preventScroll:true});
      drag={x:event.clientX,y:event.clientY,moved:0};
      area.setPointerCapture(event.pointerId);
    });
    area.addEventListener("pointermove",event=>{
      if(!event.isPrimary)return;
      if(!drag){area.classList.toggle("over-device",!!deviceAt(event));return;}
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      const previous=drag.moved;
      drag={x:event.clientX,y:event.clientY,moved:drag.moved+Math.hypot(dx,dy)};
      if(drag.moved>5){
        if(previous<=5&&active!=="display")orbitSound();
        orbit(-dx*.007,dy*.007);
      }
    });
    area.addEventListener("pointerup",event=>{
      if(!event.isPrimary||!drag)return;
      const hit=drag.moved<=5?deviceAt(event):null;
      drag=null;
      if(!hit)return;
      if(hit.device===active&&hit.control)action(hit.control);
      else if(hit.device!==active)select(hit.device);
    });
    area.addEventListener("lostpointercapture",()=>{drag=null;});
    area.addEventListener("keydown",event=>{
      const delta={ArrowLeft:[-.13,0],ArrowRight:[.13,0],ArrowUp:[0,-.11],ArrowDown:[0,.11]}[event.key];
      if(!delta||active==="display")return;
      event.preventDefault();
      orbit(...delta);
      if(!event.repeat)orbitSound();
    });

    const markerNodes=Array.from(markers.querySelectorAll("[data-open]"));
    function projectTerminal(){
      const {width:w,height:h}=display.mesh.geometry.parameters;
      display.mesh.localToWorld(surfaceA.set(-w/2,h/2,0)).project(camera);
      display.mesh.localToWorld(surfaceB.set(w/2,-h/2,0)).project(camera);
      const x=(surfaceA.x+1)*width/2+1,y=(1-surfaceA.y)*height/2+1;
      const box=[x,y,(surfaceB.x-surfaceA.x)*width/2-2,(surfaceA.y-surfaceB.y)*height/2-2].map(value=>Math.round(value));
      if(box.join()!==lastSurface){
        lastSurface=box.join();
        surface(box);
      }
    }
    function render(now) {
      pendingFrame=0;
      if(document.hidden)return;
      const elapsed=Math.min(45,(now-(last||now)));
      last=now;
      eye.setFromSpherical(spherical).add(goalTarget);
      const moving=!reduced.matches&&(
        cameraPosition.distanceToSquared(eye)>.000035||cameraTarget.distanceToSquared(goalTarget)>.000035);
      const paintView=moving||dirtyView;
      if(paintView){
        const smooth=moving?1-Math.exp(-elapsed/123):1;
        cameraPosition.lerp(eye,smooth);
        cameraTarget.lerp(goalTarget,smooth);
        camera.position.copy(cameraPosition);
        camera.lookAt(cameraTarget);
        camera.updateMatrixWorld();
      }
      dirtyView=moving;
      if(!active&&!reduced.matches){
        iron.rotation.x=Math.sin(now*.0026)*.038;
        iron.rotation.z=Math.cos(now*.0017)*.047;
      }
      if(!active&&paintView){
        markerNodes.forEach(node=>{
          projection.copy(anchor.set(...deviceAnchors[node.dataset.open])).project(camera);
          const x=(projection.x+1)*width/2,y=(1-projection.y)*height/2;
          node.hidden=x<10||x>width-10||y<33||y>height-37;
          if(!node.hidden){
            const half=node.offsetWidth/2+5;
            node.style.left=Math.max(half,Math.min(width-half,x))+"px";
            node.style.top=y+"px";
          }
        });
      }
      if(active==="display"&&!moving)projectTerminal();
      if(active==="logic"&&state.running&&!reduced.matches&&now-lastDigital>78){lastDigital=now;digital(now);}
      renderer.render(scene,camera);
      if(moving)schedule();
      else if(!reduced.matches&&(!active||(active==="logic"&&state.running)))idleTimer=setTimeout(schedule,78);
    }
    document.addEventListener("visibilitychange",()=>{
      if(!document.hidden){schedule();return;}
      cancelAnimationFrame(pendingFrame);
      pendingFrame=0;
      clearTimeout(idleTimer);
    });
    reduced.addEventListener("change",()=>{dirtyView=true;schedule();});
    document.fonts?.load('600 20px "IBM Plex Mono"').then(()=>{
      drawDisplay(active!=="display");
      meterReadout();digital();analog();
      schedule();
    }).catch(()=>{});
    function update(patch) {
      const changed=key=>Object.hasOwn(patch,key)&&patch[key]!==state[key];
      const meterChanged=["meter","meterMode"].some(changed);
      const digitalChanged=["protocol","running","sample"].some(changed);
      const analogChanged=["frequency","wave","timebase"].some(changed);
      const powerChanged=changed("powered");
      state={...state,...patch};
      if(meterChanged)meterReadout();
      if(digitalChanged)digital(performance.now());
      if(analogChanged)analog();
      if(powerChanged)powerLight();
      schedule();
    }
    return {choose,update};
  }
  return {mount,logicSamples,sampleAt,paintLogic,paintScope};
})();
