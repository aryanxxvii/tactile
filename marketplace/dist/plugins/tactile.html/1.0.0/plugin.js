var l={schemaVersion:1,packageId:"tactile.html",type:"html",name:"HTML",description:"A local HTML document.",version:"1.0.0",tactile:">=1.1.0",permissions:["native.html-preview"],entry:"plugin.jsx",extensions:["html","htm"],mimePrefixes:["text/html"]};var o=globalThis.__TACTILE_PLUGIN_HOST__;if(!o)throw new Error("Tactile plugin host is unavailable.");var J=o.React,_=o.React,$=o.React.Children,oo=o.React.Component,eo=o.React.Fragment,ro=o.React.PureComponent,ao=o.React.cloneElement,to=o.React.createContext,S=o.React.createElement,fo=o.React.createRef,v=o.React.forwardRef,lo=o.React.isValidElement,no=o.React.lazy,so=o.React.memo,co=o.React.startTransition,uo=o.React.useContext,po=o.createId,mo=o.ObjectHeader,xo=o.ObjectGlyph,Io=o.PaperPortal,io=o.useLocalDraft,Co=o.codeLanguageForExtension,go=o.resolveTauriInvoke,Fo=o.CODE_RUNTIME_TOOLS,ho=o.getCodeRuntimeProfile,So=o.setCodeRuntimePath,Bo=o.setCodeRuntimeSelected,Do=o.setCodeRuntimeDiscovery,bo=o.subscribeCodeRuntimeProfile,Lo=o.objectTypeFor,Po=o.pluginAssetUrl,wo=o.installStyle,Ao=o.React.useCallback,yo=o.React.useDeferredValue,Mo=o.React.useEffect,ko=o.React.useId,Ro=o.React.useLayoutEffect,vo=o.React.useMemo,Oo=o.React.useReducer,To=o.React.useRef,Ho=o.React.useState,No=o.React.useSyncExternalStore,qo=o.React.useTransition;var O={outline:{xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"},filled:{xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"currentColor",stroke:"none"}};var u=(r,n,x,a)=>{let d=v(({color:g="currentColor",size:F=24,stroke:I=2,title:h,className:D,children:i,...m},b)=>S("svg",{ref:b,...O[r],width:F,height:F,className:["tabler-icon",`tabler-icon-${n}`,D].join(" "),...r==="filled"?{fill:g}:{strokeWidth:I,stroke:g},...m},[h&&S("title",{key:"svg-title"},h),...a.map(([s,p])=>S(s,p)),...Array.isArray(i)?i:[i]]));return d.displayName=`${x}`,d};var z=[["path",{d:"M7 8l-4 4l4 4",key:"svg-0"}],["path",{d:"M17 8l4 4l-4 4",key:"svg-1"}],["path",{d:"M14 4l-4 16",key:"svg-2"}]],C=u("outline","code","Code",z);var X=[["path",{d:"M14 3v4a1 1 0 0 0 1 1h4",key:"svg-0"}],["path",{d:"M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2",key:"svg-1"}],["path",{d:"M12 11v6",key:"svg-2"}],["path",{d:"M9.5 13.5l2.5 -2.5l2.5 2.5",key:"svg-3"}]],w=u("outline","file-upload","FileUpload",X);var Z=[["path",{d:"M5 19l2.757 -7.351a1 1 0 0 1 .936 -.649h12.307a1 1 0 0 1 .986 1.164l-.996 5.211a2 2 0 0 1 -1.964 1.625h-14.026a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v2",key:"svg-0"}]],A=u("outline","folder-open","FolderOpen",Z);var Q=[["path",{d:"M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6",key:"svg-0"}],["path",{d:"M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0",key:"svg-1"}],["path",{d:"M8 11v-4a4 4 0 1 1 8 0v4",key:"svg-2"}]],y=u("outline","lock","Lock",Q);var e=globalThis.__TACTILE_PLUGIN_HOST__;if(!e)throw new Error("Tactile plugin host is unavailable.");var ue=e.React,t=e.React,pe=e.React.Children,me=e.React.Component,xe=e.React.Fragment,Ie=e.React.PureComponent,ie=e.React.cloneElement,Ce=e.React.createContext,ge=e.React.createElement,Fe=e.React.createRef,he=e.React.forwardRef,Se=e.React.isValidElement,Be=e.React.lazy,De=e.React.memo,be=e.React.startTransition,Le=e.React.useContext,M=e.createId,T=e.ObjectHeader,Pe=e.ObjectGlyph,we=e.PaperPortal,Ae=e.useLocalDraft,ye=e.codeLanguageForExtension,H=e.resolveTauriInvoke,Me=e.CODE_RUNTIME_TOOLS,ke=e.getCodeRuntimeProfile,Re=e.setCodeRuntimePath,ve=e.setCodeRuntimeSelected,Oe=e.setCodeRuntimeDiscovery,Te=e.subscribeCodeRuntimeProfile,He=e.objectTypeFor,Ne=e.pluginAssetUrl,B=e.installStyle,qe=e.React.useCallback,Ee=e.React.useDeferredValue,N=e.React.useEffect,Ue=e.React.useId,We=e.React.useLayoutEffect,k=e.React.useMemo,Ge=e.React.useReducer,q=e.React.useRef,E=e.React.useState,Ve=e.React.useSyncExternalStore,ze=e.React.useTransition;B(`.file-workspace {
  width: calc(100% - 24px);
  min-height: 0;
  display: grid;
  grid-template-rows: 42px minmax(0, 1fr);
  margin: 10px 12px 11px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--paper-elevated);
  box-shadow: 0 9px 22px color-mix(in srgb, var(--elevation-shadow) 38%, transparent);
}

.file-toolbar {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 3px 5px 3px 8px;
  border-bottom: 1px solid var(--line);
  background: var(--paper);
}

.file-ownership,
.file-toolbar button,
.file-toolbar a {
  height: 24px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  padding: 0 7px;
  border: 1px solid var(--line);
  border-radius: 5px;
  color: var(--muted);
  background: var(--paper-elevated);
  font-size: 8px;
}

.file-ownership {
  color: var(--positive);
  border-color: color-mix(in srgb, var(--positive) 28%, var(--line));
  background: color-mix(in srgb, var(--positive) 7%, var(--paper-elevated));
}

.file-toolbar button,
.file-toolbar a {
  text-decoration: none;
  cursor: pointer;
}

.file-toolbar button:hover,
.file-toolbar button:focus-visible,
.file-toolbar a:hover,
.file-toolbar a:focus-visible {
  outline: 0;
  color: var(--ink);
  border-color: var(--line-strong);
  background: var(--tray);
  box-shadow: 0 0 0 2px var(--accent-soft);
  user-select: text;
}

.file-meta {
  min-width: 0;
  overflow: hidden;
  color: var(--faint);
  font-family: var(--font-mono);
  font-size: 7.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-toolbar-spacer {
  flex: 1;
}

.file-stage {
  min-width: 0;
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  background:
    linear-gradient(45deg, color-mix(in srgb, var(--tray) 42%, transparent) 25%, transparent 25%) 0 0 / 18px 18px,
    linear-gradient(45deg, transparent 75%, color-mix(in srgb, var(--tray) 42%, transparent) 75%) 0 0 / 18px 18px,
    linear-gradient(45deg, transparent 75%, color-mix(in srgb, var(--tray) 42%, transparent) 75%) 9px -9px / 18px 18px,
    linear-gradient(45deg, color-mix(in srgb, var(--tray) 42%, transparent) 25%, var(--paper-elevated) 25%) 9px 9px /
      18px 18px;
}

.file-stage > img {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 3px;
  box-shadow: 0 8px 30px color-mix(in srgb, var(--elevation-shadow) 68%, transparent);
}

.file-stage > .video-player,
.file-stage > .audio-player {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.file-stage > iframe {
  width: 100%;
  height: 100%;
  border: 0;
  background: white;
}

.file-empty-state {
  width: min(360px, calc(100% - 48px));
  padding: 30px;
  border: 1px solid var(--line);
  border-radius: 10px;
  color: var(--muted);
  text-align: center;
  background: color-mix(in srgb, var(--paper-elevated) 94%, transparent);
  box-shadow:
    0 12px 34px color-mix(in srgb, var(--elevation-shadow) 48%, transparent),
    inset 0 1px 0 var(--surface-highlight);
}

.file-empty-state > svg {
  color: var(--accent);
}

.file-empty-state h2 {
  margin: 10px 0 5px;
  color: var(--ink);
  font-size: 16px;
  letter-spacing: -0.025em;
}

.file-empty-state p {
  margin: 0;
  font-size: 9.5px;
  line-height: 1.55;
}

.file-empty-state button {
  height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  padding: 0 9px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  color: var(--paper-elevated);
  background: var(--accent);
  font-size: 8.5px;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 var(--surface-highlight-soft),
    0 2px 5px color-mix(in srgb, var(--elevation-shadow) 60%, transparent);
}

.file-empty-state button:hover,
.file-empty-state button:focus-visible {
  outline: 0;
  filter: brightness(0.95);
  box-shadow:
    0 0 0 3px var(--accent-soft),
    inset 0 1px 0 var(--surface-highlight-soft);
}

@media (max-width: 900px) {
  .file-workspace {
    width: calc(100% - 16px);
    margin-inline: 8px;
  }
}
`);function U(r,n,x){return{type:r.type,label:r.name,description:r.description,icon:x,package:{id:r.packageId,version:r.version},renderer:{load:async()=>n},cell:{project:({object:a,fallbackValue:d})=>({displayValue:a?.title||d||r.name})},create:(a={})=>({...a,id:a.id||M(r.type),type:r.type,title:a.title||`Untitled ${r.name}`,description:a.description||"",parent:a.parent||null,assetId:a.assetId||null,source:a.source||""}),validate:a=>({valid:a?.type===r.type,errors:a?.type===r.type?[]:[`Object type must be ${r.type}.`]}),migrate:(a,d)=>({...a,id:a?.id||d||M(r.type),type:r.type,assetId:a?.assetId||null,source:a?.source||""}),serialize:a=>a,deserialize:a=>a,assetPolicy:{kind:"external-asset",acceptsBinary:!0,extensions:r.extensions||[],mimePrefixes:r.mimePrefixes||[]}}}B(`.html-source-control {
  min-width: 0;
  height: 24px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 6px;
  border: 1px solid var(--line);
  border-radius: 5px;
  color: var(--muted);
  background: var(--paper-elevated);
  font-size: 8px;
}

.html-source-control > span {
  color: var(--faint);
}

.html-source-control select {
  width: min(230px, 24vw);
  min-width: 90px;
  height: 20px;
  padding: 0 18px 0 4px;
  border: 0;
  outline: 0;
  color: var(--ink);
  background: transparent;
  font-family: var(--font-ui);
  font-size: 8px;
  cursor: pointer;
}

.html-source-control:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

@media (max-width: 720px) {
  .html-source-control > span,
  .html-toolbar .file-meta {
    display: none;
  }

  .html-source-control select {
    width: min(180px, 38vw);
  }
}
`);function K(r){let n=/^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(r||""));if(!n)return"";try{return n[2]?atob(n[3]):decodeURIComponent(n[3])}catch{return""}}function W({object:r,path:n,saveState:x,onUpdateObject:a,onBack:d,canGoBack:g,workspaceActions:F,workspaceObjects:I,assets:h,onReplaceFile:D,onReparentObject:i}){let m=r.assetId?h?.[r.assetId]:null,b=k(()=>Object.values(I||{}).filter(f=>f?.type==="code"&&(f.language==="html"||f.id===r.sourceObjectId)).sort((f,c)=>String(f.title||"").localeCompare(String(c.title||""))),[r.sourceObjectId,I]),s=r.sourceObjectId?I?.[r.sourceObjectId]:null,p=k(()=>s?.type==="code"?String(s.content||""):r.source||K(m?.dataUrl),[m?.dataUrl,s,r.source]),L=q(null),[R,P]=E("");return N(()=>{let f=H();if(!f||!p){P("");return}let c=!0;return f("workspace_serve_html",{content:p}).then(G=>c&&P(String(G||""))).catch(()=>c&&P("")),()=>{c=!1}},[p]),t.createElement("article",{className:"object-surface file-object","data-object-type":"html"},t.createElement(T,{object:r,path:n,saveState:x,onChange:a,onBack:d,canGoBack:g,workspaceActions:F,onReparentObject:i}),t.createElement("main",{className:"file-workspace"},t.createElement("input",{ref:L,className:"native-file-input",type:"file",accept:".html,.htm,text/html",tabIndex:-1,"aria-hidden":"true",onChange:f=>{let c=f.target.files?.[0];f.target.value="",c&&D?.(c)}}),t.createElement("div",{className:"file-toolbar html-toolbar"},t.createElement("span",{className:"file-ownership"},t.createElement(y,{size:13})," On this device"),t.createElement("label",{className:"html-source-control"},t.createElement(C,{size:13,stroke:1.55}),t.createElement("span",null,"Source"),t.createElement("select",{value:r.sourceObjectId||"","aria-label":"HTML source cell",onChange:f=>a({sourceObjectId:f.target.value||null})},t.createElement("option",{value:""},"Local HTML file"),r.sourceObjectId&&!s?t.createElement("option",{value:r.sourceObjectId},"Unavailable code source"):null,b.map(f=>t.createElement("option",{key:f.id,value:f.id},[f.parent?.sourceAddress,f.title||"Untitled HTML code"].filter(Boolean).join(" \xB7 "))))),t.createElement("span",{className:"file-meta"},s?s.title||"HTML code":m?.fileName||"HTML"),t.createElement("span",{className:"file-toolbar-spacer"}),t.createElement("button",{type:"button",onClick:()=>L.current?.click()},t.createElement(w,{size:13})," ",m||r.source?"Replace":"Choose file")),t.createElement("div",{className:"file-stage"},p?t.createElement("iframe",{src:R||void 0,srcDoc:R?void 0:p,title:r.title,sandbox:"allow-forms allow-modals allow-popups allow-same-origin allow-scripts"}):t.createElement("div",{className:"file-empty-state"},t.createElement("h2",null,r.sourceObjectId?"Code source unavailable":"Local content unavailable"),t.createElement("p",null,r.sourceObjectId?"Select another HTML Code cell or choose a local HTML file.":"Choose a local HTML file or select an HTML Code cell as the live source."),t.createElement("button",{type:"button",onClick:()=>L.current?.click()},t.createElement(A,{size:14})," Choose HTML")))))}var j=l;function sr(){return U(j,W,C)}export{sr as activate};
