const LabArt = (() => {
  const floor = 250;
  const worldWidth = 930;
  const height = 316;
  const palettes = [
    {sky:"#272d52",haze:"#cd7886",far:"#4a4566",wall:"#313c56",metal:"#667e98",lamp:"#ffcd73",trim:"#ca835b"},
    {sky:"#172e49",haze:"#478f81",far:"#38536a",wall:"#253f53",metal:"#588d92",lamp:"#7af0cf",trim:"#427c79"},
    {sky:"#263051",haze:"#8669a5",far:"#4f5177",wall:"#373a59",metal:"#817ba6",lamp:"#d1a4ff",trim:"#8366a0"},
    {sky:"#372942",haze:"#bd705d",far:"#6b4f62",wall:"#493850",metal:"#947376",lamp:"#ffbf70",trim:"#ba7852"},
    {sky:"#273455",haze:"#ca8b7e",far:"#5c5c7d",wall:"#334a62",metal:"#7799ae",lamp:"#90e8cf",trim:"#739b9f"},
  ];

  function rect(c,x,y,w,h,color) {
    c.fillStyle=color;
    c.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));
  }

  function polygon(c,points,color) {
    c.beginPath();
    points.forEach(([x,y],i) => i ? c.lineTo(Math.round(x),Math.round(y)) : c.moveTo(Math.round(x),Math.round(y)));
    c.closePath();
    c.fillStyle=color;
    c.fill();
  }

  function text(c,value,x,y,color,size=10,align="left") {
    c.fillStyle=color;
    c.textAlign=align;
    c.font=`bold ${size}px monospace`;
    c.fillText(value,Math.round(x),Math.round(y));
  }

  function stroke(c,points,color,width=1) {
    c.beginPath();
    points.forEach(([x,y],i) => i ? c.lineTo(Math.round(x),Math.round(y)) : c.moveTo(Math.round(x),Math.round(y)));
    c.lineWidth=width;
    c.strokeStyle=color;
    c.stroke();
  }

  function light(c,x,y,size,color) {
    const gradient=c.createRadialGradient(x,y,0,x,y,size);
    gradient.addColorStop(0,color+"50");
    gradient.addColorStop(1,color+"00");
    rect(c,x-size,y-size,size*2,size*2,gradient);
  }

  function skyline(c,p,width,offset,chapter) {
    const fade=c.createLinearGradient(0,0,0,217);
    fade.addColorStop(0,p.sky);
    fade.addColorStop(.95,p.haze);
    rect(c,0,0,width,height,fade);
    for(let i=0;i<40;i++){
      const x=(29+i*73.37)%Math.max(100,width+90)-30;
      const y=11+i*19%103;
      rect(c,x,y,i%7===0?2:1,1,i%3?"#e6d9ee90":"#ffd391");
    }
    const sunX=width*.76-offset*.035;
    c.beginPath();
    c.arc(sunX,73,30,0,Math.PI*2);
    c.fillStyle=chapter===1?"#acdfcc":"#ffd69b";
    c.fill();
    for(let i=0;i<4;i++) rect(c,sunX-32,79+i*6,64,2,p.haze);
    for(let i=0;i<5;i++){
      const x=(i*167-offset*.18)%890-40;
      polygon(c,[[x,124],[x+28,118],[x+54,121],[x+63,125],[x+110,128],[x+104,132],[x+8,132]],"#efd4cc33");
    }
    for(let layer=0;layer<2;layer++){
      const shift=(offset*(.16+layer*.12))%85;
      for(let i=-1;i<Math.ceil(width/55)+2;i++){
        const x=i*63-shift;
        const y=151-(i*i*13+41+layer*9)%44+layer*32;
        rect(c,x,y,58,140-y+layer*41,layer?p.wall:p.far);
        rect(c,x+6,y-4,37,4,layer?p.wall:p.far);
        if(i%3===0) rect(c,x+19,y-12,4,10,layer?p.wall:p.far);
        for(let n=0;n<4;n++){
          if((i+n)%3!==0) rect(c,x+8+n*11,y+9,3,3,layer?"#e8b875b0":"#e4abc15c");
        }
      }
    }
  }

  function chassis(c,x,y,w,h,p) {
    rect(c,x+4,y+7,w,h,"#121b30");
    rect(c,x,y,w,h,p.wall);
    rect(c,x,y,w,3,p.metal);
    rect(c,x,y,3,h,"#92a4b144");
    rect(c,x+w-4,y,4,h,"#141e32");
    rect(c,x,y+h-3,w,3,"#141e32");
    for(const dx of [5,w-8]){
      for(const dy of [5,h-8]) rect(c,x+dx,y+dy,3,3,"#aab4ca");
    }
  }

  function ceiling(c,p,room) {
    rect(c,0,141,worldWidth,5,"#22293d");
    rect(c,0,145,worldWidth,59,p.wall);
    for(let x=0;x<worldWidth;x+=73){
      rect(c,x,147,70,51,"#17263b");
      rect(c,x+2,149,66,47,p.wall);
      rect(c,x+6,153,62,1,"#c2bdd135");
      for(let j=0;j<3;j++) rect(c,x+12+j*13,181,7,1,"#8c9eb23f");
    }
    rect(c,0,199,worldWidth,51,"#1f2941");
    rect(c,0,203,worldWidth,3,p.metal);
    for(let x=0;x<worldWidth;x+=33) rect(c,x,207,2,42,"#40516b70");
    const signWidth=room.name.length*8+24;
    rect(c,48,109,signWidth,25,"#171f32");
    rect(c,48,109,signWidth,2,p.lamp);
    text(c,room.name.toUpperCase(),59,126,p.lamp,12);
    for(const x of [24,238,522,774,910]){
      rect(c,x,136,9,114,p.metal);
      rect(c,x+2,136,2,114,"#dfdeec48");
      rect(c,x+7,136,2,114,"#1c253b");
      rect(c,x-5,137,20,4,"#1a2337");
      rect(c,x-5,244,20,6,"#141f33");
    }
    for(const x of [103,317,611,796]){
      rect(c,x,149,29,5,"#172230");
      rect(c,x+2,151,25,3,p.lamp);
      light(c,x+13,154,24,p.lamp);
    }
  }

  function ground(c,p) {
    rect(c,0,250,worldWidth,height-250,"#161f34");
    rect(c,0,250,worldWidth,4,p.metal);
    rect(c,0,254,worldWidth,9,p.wall);
    for(let x=0;x<worldWidth;x+=27){
      rect(c,x,260,21,2,"#10182a");
      rect(c,x+3,264,1,52,"#53658357");
      rect(c,x+7,285,3,3,x%5===0?p.lamp:"#313c56");
    }
    rect(c,0,274,worldWidth,3,"#2e4156");
    rect(c,0,301,worldWidth,3,"#2a354f");
    stroke(c,[[0,291],[260,291],[275,281],[384,281],[396,291],[720,291],[737,282],[930,282]],p.trim,2);
    stroke(c,[[0,296],[260,296],[277,286],[381,286],[395,296],[930,296]],"#596f92",1);
    for(const x of [23,728,905]) for(let n=0;n<4;n++){
      polygon(c,[[x+n*7,250],[x+4+n*7,250],[x+8+n*7,257],[x+4+n*7,257]],"#ffc577");
    }
  }

  function crate(c,x,y,p) {
    chassis(c,x,y,29,24,p);
    stroke(c,[[x+4,y+5],[x+24,y+19]],p.metal,2);
    stroke(c,[[x+24,y+5],[x+4,y+19]],p.metal,2);
  }

  function platform(c,platform,p) {
    const {x,y,w}=platform;
    rect(c,x,y,w,4,p.metal);
    rect(c,x,y+4,w,6,"#222e43");
    for(let i=0;i<w-10;i+=11) rect(c,x+4+i,y+2,5,1,p.trim);
    stroke(c,[[x+2,y+10],[x+16,y+20],[x+39,y+10]],"#344864",2);
  }

  function scope(c,x,y,p,time,on) {
    chassis(c,x,y,99,61,p);
    rect(c,x+8,y+8,69,41,"#0e1b2b");
    for(let i=0;i<6;i++) rect(c,x+10+i*11,y+11,1,34,"#284356");
    for(let i=0;i<4;i++) rect(c,x+10,y+11+i*11,62,1,"#284356");
    const points=[];
    for(let i=0;i<62;i++) {
      const high=(i+(on?Math.floor(time*.026):0))%18<8;
      points.push([x+10+i,y+(high?18:39)]);
    }
    stroke(c,points,on?"#8affcf":p.lamp,1.7);
    for(let i=0;i<3;i++) rect(c,x+83,y+12+i*11,7,5,i===0?p.lamp:"#71809e");
    rect(c,x+18,y+61,64,5,"#142137");
  }

  function processor(c,x,y,p) {
    chassis(c,x,y,101,32,p);
    rect(c,x+7,y+5,87,19,"#26766b");
    rect(c,x+35,y+7,22,15,"#122133");
    for(let n=0;n<6;n++){
      rect(c,x+10+n*13,y+24,4,3,"#e9b875");
      rect(c,x+36+n*3,y+5,1,2,"#f6d99e");
      rect(c,x+36+n*3,y+22,1,2,"#f6d99e");
    }
    stroke(c,[[x+56,y+12],[x+71,y+12],[x+75,y+18],[x+91,y+18]],"#9ef7c8",1);
    rect(c,x+12,y+9,10,12,"#a2bfca");
    rect(c,x+78,y+7,11,7,"#ffcd73");
  }

  function camera(c,x,y,p,on) {
    rect(c,x+26,y+43,8,26,"#202c46");
    rect(c,x+11,y+67,38,4,"#151e35");
    chassis(c,x,y+8,60,40,p);
    rect(c,x+35,y+17,23,23,"#19253f");
    rect(c,x+39,y+20,17,17,"#445f8f");
    rect(c,x+44,y+23,11,11,"#81cbe1");
    rect(c,x+47,y+25,4,4,"#bcf5f7");
    rect(c,x+8,y+16,6,4,on?"#a6ffca":"#ffc582");
    text(c,"CAM",x+8,y+37,"#dee9ff",8);
  }

  function fan(c,x,y,p,time,on) {
    chassis(c,x,y,66,62,p);
    const cx=x+33,cy=y+29;
    c.beginPath();
    c.arc(cx,cy,22,0,Math.PI*2);
    c.fillStyle="#142033";
    c.fill();
    const angle=on?time*.007:0;
    for(let i=0;i<5;i++){
      const a=angle+i*1.2566;
      const blade=[[3,1],[10,-7],[19,-4],[20,4],[12,8],[5,5]];
      polygon(c,blade.map(([u,v])=>[cx+u*Math.cos(a)-v*Math.sin(a),cy+u*Math.sin(a)+v*Math.cos(a)]),i%2?p.metal:"#9baabd");
    }
    rect(c,cx-4,cy-4,8,8,"#d4decf");
    rect(c,x+17,y+54,33,3,on?"#93f8d5":p.lamp);
  }

  function portal(c,x,p,last,ready) {
    chassis(c,x-25,164,50,86,p);
    rect(c,x-18,172,36,78,"#131e32");
    rect(c,x-15,175,30,72,last&&!ready?"#4a3448":"#223b55");
    rect(c,x-11,185,22,2,last&&!ready?"#ffc282":p.lamp);
    rect(c,x+7,214,4,8,p.lamp);
    text(c,last?"HUB":"AIRLOCK",x,158,"#efe2ce",8,"center");
  }

  function workstation(c,station,p,kind,time,on) {
    const x=station.x;
    rect(c,x-51,227,102,5,p.metal);
    rect(c,x-42,232,4,18,"#35445d");
    rect(c,x+37,232,4,18,"#35445d");
    if(kind==="bms"){
      scope(c,x-47,159,p,time,on);
      processor(c,x+58,198,p);
      stroke(c,[[x+49,226],[x+58,220]],p.lamp,2);
    } else if(kind==="adas"){
      camera(c,x-42,155,p,on);
      scope(c,x+62,160,p,time,on);
      stroke(c,[[x+16,225],[x+40,225],[x+53,219],[x+63,219]],p.lamp,2);
    } else if(kind==="thermal"){
      fan(c,x-38,164,p,time,on);
      processor(c,x+56,196,p);
      stroke(c,[[x+26,217],[x+48,217],[x+58,220]],p.lamp,2);
    } else if(kind==="finish"){
      scope(c,x-49,157,p,time,on);
      for(let i=0;i<3;i++){
        chassis(c,x+59+i*23,185,20,39,p);
        rect(c,x+65+i*23,192,8,7,on?p.lamp:"#ed9269");
      }
    } else {
      chassis(c,x-31,173,62,51,p);
      rect(c,x-23,181,46,24,"#141f33");
      text(c,"START",x,197,p.lamp,9,"center");
      rect(c,x-13,213,26,4,"#111c30");
    }
    light(c,x,177,30,on?"#82f5ba":p.lamp);
    rect(c,x-2,148,4,4,on?"#82f5ba":p.lamp);
  }

  function player(c,state,time) {
    const {x,y,facing,walking}=state;
    const bend=walking?Math.sin(time*.019):0;
    const step=Math.round(bend*4);
    c.save();
    c.translate(Math.round(x),Math.round(y));
    c.scale(facing||1,1);
    if(y>=floor-1) rect(c,-13,0,25,3,"#0a1424b0");
    rect(c,-8,-13,7,13,"#223350");
    rect(c,2,-13,7,13,"#223350");
    rect(c,-10-step,-5+Math.max(0,step),10,5,"#0d1e31");
    rect(c,1+step,-5+Math.max(0,-step),10,5,"#0d1e31");
    rect(c,-10,-27,20,16,"#e8a44f");
    rect(c,-7,-27,14,14,"#ffcc73");
    rect(c,-9,-20,18,3,"#fff0ae");
    rect(c,-13,-23,5,9,"#647b93");
    rect(c,8,-23,5,10,"#dc944b");
    rect(c,3,-23,3,4,"#25384e");
    rect(c,-7,-36,14,10,"#b97c5a");
    rect(c,-9,-38,17,5,"#213147");
    rect(c,-6,-41,12,4,"#385369");
    rect(c,4,-33,7,4,"#9beada");
    rect(c,5,-32,4,1,"#defdf4");
    rect(c,-8,-34,3,6,"#5b7898");
    c.restore();
  }

  function render(c,frame) {
    const {room,index,width,offset,avatar,online,motion,time}=frame;
    const p=palettes[index];
    const clock=motion?time:0;
    skyline(c,p,width,offset,index);
    c.save();
    c.translate(-Math.round(offset),0);
    ceiling(c,p,room);
    for(const x of [72,639,670,899]) crate(c,x,226,p);
    for(const ledge of room.platforms) platform(c,ledge,p);
    ground(c,p);
    if(index>0) portal(c,25,p,false,true);
    if(index<4) portal(c,898,p,index===3,online);
    if(room.note){
      const x=room.note.x;
      chassis(c,x-13,190,26,31,p);
      rect(c,x-8,195,16,16,"#17253b");
      rect(c,x-5,198,11,2,"#f7e1a9");
      rect(c,x-5,203,8,1,"#967fa0");
      rect(c,x-2,222,4,28,p.metal);
      text(c,"LOG",x,183,p.lamp,8,"center");
    }
    workstation(c,room.station,p,room.id,clock,online);
    if(index===0){
      scope(c,670,163,p,clock,false);
      processor(c,765,197,p);
      stroke(c,[[659,224],[668,224],[675,219]],p.lamp,2);
    }
    if(!online&&motion){
      for(let i=0;i<4;i++){
        const x=room.station.x-13+i*7,y=153-(clock*.025+i*11)%32;
        rect(c,x,y,2,2,i%2?p.lamp:"#e5efd6");
      }
    }
    player(c,avatar,clock);
    c.restore();
  }

  return {render,floor,worldWidth,height};
})();
