const BenchTerminal = (() => {
  const home="/home/aziz";
  const nodes=new Map([["/",{children:new Map()}]]);
  const basename=path=>path.slice(path.lastIndexOf("/")+1);
  const dirname=path=>path.slice(0,path.lastIndexOf("/"))||"/";
  function directory(path) {
    if(nodes.has(path))return nodes.get(path);
    const node={children:new Map()};
    directory(dirname(path)).children.set(basename(path),path);
    nodes.set(path,node);
    return node;
  }
  directory(home);
  for(const [name,file] of Object.entries(BenchFiles.files)){
    const path=home+"/"+name;
    directory(dirname(path)).children.set(basename(path),path);
    nodes.set(path,{file});
  }

  function resolve(cwd,path="") {
    if(path==="~"||path.startsWith("~/"))path=home+path.slice(1);
    const parts=path.startsWith("/")?[]:cwd.split("/").filter(Boolean);
    for(const part of path.split("/")){
      if(part==="..")parts.pop();
      else if(part&&part!==".")parts.push(part);
    }
    return "/"+parts.join("/");
  }
  const displayPath=path=>path===home||path.startsWith(home+"/")?"~"+path.slice(home.length):path;
  const element=(tag,text,className)=>{
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=text;
    return node;
  };
  function link(data) {
    const a=element("a",data.label);
    a.href=data.href;
    if(data.href.startsWith("https://")){a.target="_blank";a.rel="noopener noreferrer";}
    return a;
  }
  function renderFile(file) {
    const article=element("article",undefined,"terminal-document");
    article.append(element("h2",file.title));
    if(file.subtitle)article.append(element("p",file.subtitle,"terminal-file-meta"));
    if(file.intro)article.append(element("p",file.intro));
    if(file.diagram)article.append(element("pre",file.diagram,"terminal-diagram"));
    for(const [heading,body] of file.sections||[])article.append(element("h3",heading),element("p",body));
    if(file.links?.length){
      const links=element("div",undefined,"terminal-links");
      links.append(...file.links.map(link));
      article.append(links);
    }
    return article;
  }

  function mount(root,{cue,leave}) {
    root.innerHTML=`
      <div class="terminal-chrome"><span>aziz@bench <span class="terminal-system">/ Linux portfolio</span></span><span id="terminal-location" title="/home/aziz">~</span></div>
      <div class="terminal-shell">
        <div class="terminal-log" id="terminal-log" tabindex="0" aria-label="Terminal output"></div>
        <nav class="terminal-shortcuts" aria-label="Terminal shortcuts">
          <button type="button" data-command="tree ~">tree</button>
          <button type="button" data-command="less ~/README.md">README</button>
          <button type="button" data-command="ls ~/experience">experience</button>
          <button type="button" data-command="ls ~/projects">projects</button>
          <button type="button" data-command="less ~/contact/links.md">contact</button>
          <button type="button" data-command="help">help</button>
        </nav>
        <form id="terminal-form" class="terminal-form">
          <label id="terminal-prompt" for="terminal-input"><span>aziz@bench</span><b>~</b>$</label>
          <input id="terminal-input" aria-label="Terminal command" type="text" placeholder="Type a command" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go">
          <button type="submit" aria-label="Run command">Run</button>
        </form>
      </div>
      <div class="terminal-pager" id="terminal-pager" hidden>
        <div class="pager-bar"><span id="pager-path"></span><button type="button" id="pager-close">Close file <span>q</span></button></div>
        <div class="pager-content" id="pager-content" tabindex="0" aria-label="File contents"></div>
      </div>
      <span class="sr-only" id="terminal-announcement" role="status"></span>`;
    const query=id=>root.querySelector("#"+id);
    const log=query("terminal-log");
    const input=query("terminal-input");
    const pager=query("terminal-pager");
    const pagerContent=query("pager-content");
    const shell=root.querySelector(".terminal-shell");
    let cwd=home, historyIndex=0, draft="", returnTo=null;
    const history=[];
    const maxHistory=70;
    const announce=message=>{query("terminal-announcement").textContent=message;};
    function updatePath() {
      const location=query("terminal-location");
      location.textContent=displayPath(cwd);
      location.title=cwd;
      query("terminal-prompt").querySelector("b").textContent=displayPath(cwd);
    }
    function scrollToResult(node) {
      log.scrollTop=log.scrollHeight;
      const y=node.getBoundingClientRect().top-log.getBoundingClientRect().top;
      if(y<0)log.scrollTop+=y-6;
    }
    function line(text,className="terminal-line") {
      const node=element("p",text,className);
      log.append(node);
      scrollToResult(node);
      return node;
    }
    function commandLine(command) {
      const output=element("p",undefined,"terminal-command");
      output.append(element("span",`aziz@bench:${displayPath(cwd)}$`),document.createTextNode(" "+command));
      log.append(output);
      scrollToResult(output);
    }
    function error(message) {
      line(message,"terminal-error");
      announce(message);
      cue("error");
    }
    function openFile(path) {
      const node=nodes.get(path);
      if(!node?.file)return error(`less: ${displayPath(path)}: ${node?"Is a directory":"No such file"}`);
      const {file}=node;
      returnTo=document.activeElement;
      query("pager-path").textContent=`less ${displayPath(path)}`;
      pagerContent.replaceChildren(renderFile(file));
      pager.hidden=false;
      shell.hidden=true;
      pagerContent.scrollTop=0;
      pagerContent.focus({preventScroll:true});
      announce(`Reading ${file.title}.`);
      cue("file");
    }
    function closeReader() {
      if(pager.hidden)return false;
      pager.hidden=true;
      shell.hidden=false;
      if(returnTo&&shell.contains(returnTo))returnTo.focus({preventScroll:true});
      else log.focus({preventScroll:true});
      returnTo=null;
      return true;
    }
    function pathButton(record,name) {
      const isDir=!!nodes.get(record).children;
      const button=element("button",name+(isDir?"/":""),isDir?"terminal-directory":"terminal-file");
      button.type="button";
      button.title=displayPath(record);
      button.addEventListener("click",()=>{
        if(isDir){
          run("cd "+displayPath(record));
          run("ls");
        }else run("less "+displayPath(record));
      });
      return button;
    }
    function list(path,long) {
      const node=nodes.get(path);
      if(!node)return error(`ls: cannot access '${displayPath(path)}': No such file or directory`);
      const block=element("div",undefined,long?"terminal-list long":"terminal-list");
      const entries=node.children?[...node.children.entries()]:[[basename(path),path]];
      for(const [name,entry] of entries){
        const button=pathButton(entry,name);
        if(long){
          const row=element("div");
          row.append(element("span",nodes.get(entry).children?"dr-xr-xr-x":"-r--r--r--"),button);
          block.append(row);
        }else block.append(button);
      }
      log.append(block);
      scrollToResult(block);
      announce(`${entries.length} entries in ${displayPath(path)}.`);
    }
    function tree(path) {
      const node=nodes.get(path);
      if(!node)return error(`tree: ${displayPath(path)}: No such file or directory`);
      if(!node.children)return error(`tree: ${displayPath(path)}: Not a directory`);
      const block=element("div",undefined,"terminal-tree");
      block.append(element("div",displayPath(path),"terminal-tree-root"));
      let dirs=0,files=0;
      function branches(directoryPath,indent) {
        const children=[...nodes.get(directoryPath).children.entries()];
        children.forEach(([name,child],i)=>{
          const final=i===children.length-1;
          const row=element("div",undefined,"terminal-branch");
          const branch=element("span",indent+(final?"└── ":"├── "));
          branch.setAttribute("aria-hidden","true");
          row.append(branch,pathButton(child,name));
          block.append(row);
          if(nodes.get(child).children){dirs++;branches(child,indent+(final?"    ":"│   "));}
          else files++;
        });
      }
      branches(path,"");
      block.append(element("p",`${dirs} directories, ${files} files`,"terminal-muted"));
      log.append(block);
      scrollToResult(block);
      announce(`File tree: ${dirs} directories, ${files} files.`);
    }
    const help=[
      ["ls [-l] [path]","List files and directories"],
      ["tree [path]","Show the directory tree"],
      ["cd [path]","Change directory. Use ~ to go home"],
      ["pwd · whoami","Show the path or username"],
      ["cat <file>","Print a file in the terminal"],
      ["less <file>","Read a file. Press q to close"],
      ["open linkedin","Open LinkedIn. Also accepts github and resume"],
      ["history · clear","Show command history or clear the screen"],
      ["exit","Return to the workbench"],
    ];
    function helpOutput() {
      const dl=element("dl",undefined,"terminal-help");
      for(const [command,usage] of help)dl.append(element("dt",command),element("dd",usage));
      log.append(dl,element("p","Use Tab to complete a path, Up/Down for command history, or select a file directly.","terminal-muted"));
      scrollToResult(dl);
      announce("Command help.");
    }
    const commands={
      help:helpOutput,
      pwd:()=>line(cwd),
      whoami:()=>line("aziz"),
      clear:()=>log.replaceChildren(),
      ls:args=>list(resolve(cwd,args.find(arg=>!arg.startsWith("-"))),args.includes("-l")||args.includes("-la")||args.includes("-al")),
      tree:args=>tree(resolve(cwd,args[0])),
      cd:args=>{
        const next=resolve(cwd,args[0]||"~");
        const node=nodes.get(next);
        if(!node?.children)return error(`cd: ${args[0]}: ${node?"Not a directory":"No such file or directory"}`);
        cwd=next;
        updatePath();
        announce(`Directory changed to ${cwd}.`);
      },
      cat:args=>{
        if(!args.length)return error("Usage: cat <file>");
        for(const arg of args){
          const node=nodes.get(resolve(cwd,arg));
          if(!node?.file){error(`cat: ${arg}: ${node?"Is a directory":"No such file"}`);continue;}
          const file=renderFile(node.file);
          log.append(file);
          scrollToResult(file);
          announce(`Printed ${node.file.title}.`);
          cue("file");
        }
      },
      less:args=>args[0]?openFile(resolve(cwd,args[0])):error("Usage: less <file>"),
      open:args=>{
        if(!args[0])return error("Usage: open <file|linkedin|github|resume>");
        const path=resolve(cwd,args[0]);
        const profile=Object.hasOwn(BenchFiles.profiles,args[0])?BenchFiles.profiles[args[0]]:nodes.get(path)?.file?.destination;
        if(!profile)return openFile(path);
        const output=element("p",undefined,"terminal-line");
        const destination=link(profile);
        output.append("Opening ",destination);
        log.append(output);
        scrollToResult(output);
        if(profile.href.startsWith("mailto:"))destination.click();
        else window.open(profile.href,"_blank","noopener,noreferrer");
        announce(`Opened ${profile.label}.`);
        cue("file");
      },
      history:()=>line(history.map((command,i)=>`${i+1}  ${command}`).join("\n"),"terminal-history"),
      exit:leave,
    };
    function run(raw) {
      const command=raw.trim();
      if(!command)return;
      history.push(command);
      if(history.length>maxHistory)history.shift();
      historyIndex=history.length;
      draft="";
      const parts=command.match(/"[^"]*"|'[^']*'|[^\s"']+/g)||[];
      const [name,...args]=parts.map(token=>token.replace(/^["']|["']$/g,""));
      commandLine(command);
      cue("command");
      if(Object.hasOwn(commands,name))commands[name](args);
      else error(`bash: ${name||command}: command not found. Try help.`);
      while(log.childElementCount>180)log.firstElementChild.remove();
    }
    function commonPrefix(names) {
      return names.reduce((prefix,name)=>{
        let i=0;
        while(i<prefix.length&&prefix[i]===name[i])i++;
        return prefix.slice(0,i);
      });
    }
    function completeInput(event) {
      if(!input.value.trim()||input.selectionStart!==input.value.length)return;
      const before=input.value;
      const match=/[^\s]*$/.exec(before);
      const prefix=match[0],start=match.index;
      const slash=prefix.lastIndexOf("/");
      const stem=slash>=0?prefix.slice(0,slash+1):"";
      const names=start===0?Object.keys(commands):
        [...(nodes.get(resolve(cwd,stem||"."))?.children?.entries()||[])].map(([name,path])=>name+(nodes.get(path).children?"/":""));
      const candidates=names.filter(name=>name.startsWith(prefix.slice(stem.length)));
      // Tab still leaves the input if there is nothing new to complete.
      if(!candidates.length)return;
      const replacement=stem+commonPrefix(candidates);
      if(replacement===prefix&&candidates.length===1)return;
      event.preventDefault();
      if(replacement!==prefix)input.value=before.slice(0,start)+replacement+(candidates.length===1&&!replacement.endsWith("/")?" ":"");
      if(candidates.length>1)line(candidates.join("   "),"terminal-muted");
      announce(candidates.join(", "));
    }
    query("terminal-form").addEventListener("submit",event=>{
      event.preventDefault();
      const command=input.value;
      input.value="";
      run(command);
    });
    input.addEventListener("input",()=>cue("key"));
    input.addEventListener("keydown",event=>{
      if(event.key==="Tab"&&!event.shiftKey){completeInput(event);return;}
      if(event.key==="ArrowUp"||event.key==="ArrowDown"){
        if(!history.length)return;
        event.preventDefault();
        if(historyIndex===history.length)draft=input.value;
        historyIndex=Math.max(0,Math.min(history.length,historyIndex+(event.key==="ArrowUp"?-1:1)));
        input.value=history[historyIndex]??draft;
        input.setSelectionRange(input.value.length,input.value.length);
        return;
      }
    });
    root.querySelector(".terminal-shortcuts").addEventListener("click",event=>{
      const button=event.target.closest("[data-command]");
      if(button)run(button.dataset.command);
    });
    query("pager-close").addEventListener("click",closeReader);
    pager.addEventListener("keydown",event=>{
      if(event.key.toLowerCase()==="q"&&!event.ctrlKey&&!event.metaKey){
        event.preventDefault();
        closeReader();
      }
    });
    updatePath();
    line("Explore the portfolio with a command or select a file or folder.","terminal-muted");
    commandLine("ls");
    list(home,false);
    return {
      closeReader,
      read(path){run("less ~/"+path);},
      focus(preferPrompt=false){(pager.hidden?(preferPrompt?input:log):pagerContent).focus({preventScroll:true});},
    };
  }
  return {mount};
})();
