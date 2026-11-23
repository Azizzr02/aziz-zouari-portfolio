const BenchAudio = (() => {
  const preference="aziz-bench-audio";
  const clips={
    enable:"enable",display:"display",meter:"meter",logic:"logic",scope:"scope",board:"board",
    overview:"step",walk:"step",key:"key",command:"command",file:"file",error:"error",
    continuity:"continuity",switch:"switch",
  };

  function mount(button,announcement) {
    const cues=document.getElementById("bench-cue");
    const keys=document.getElementById("bench-keys");
    cues.volume=.64;
    keys.volume=.48;
    let enabled=false;
    let lastKey=-Infinity;
    try {enabled=localStorage.getItem(preference)==="on";} catch {}

    function show() {
      button.setAttribute("aria-pressed",String(enabled));
      button.querySelector(".sound-label").textContent=enabled?"Sound on":"Sound off";
    }
    function save() {
      try {localStorage.setItem(preference,enabled?"on":"off");} catch {}
    }
    function cue(name) {
      if(!enabled||!Object.hasOwn(clips,name)||navigator.userActivation?.hasBeenActive===false)return;
      const key=name==="key";
      if(key) {
        const now=performance.now();
        if(now-lastKey<49)return;
        lastKey=now;
      }
      const player=key?keys:cues;
      const src="sounds/"+clips[name]+".wav";
      if(player.getAttribute("src")!==src)player.src=src;
      else player.currentTime=0;
      player.play().catch(error=>{
        if(error.name==="AbortError"||!enabled||player.getAttribute("src")!==src)return;
        if(error.name==="NotAllowedError"){
          enabled=false;
          save();
          show();
          announcement.textContent="Select Sound off once to enable playback in this tab.";
        }else announcement.textContent="This sound could not be played.";
      });
    }
    button.addEventListener("click",()=>{
      enabled=!enabled;
      show();
      save();
      if(enabled){
        announcement.textContent="Bench audio enabled.";
        cue("enable");
      }else{
        cues.pause();
        keys.pause();
        announcement.textContent="Bench audio muted.";
      }
    });
    show();
    return cue;
  }
  return {mount};
})();
