var l={schemaVersion:1,packageId:"tactile.sites",type:"sites",name:"Sites",description:"A web site embedded in the Tactile window as a real browser view.",version:"1.0.0",tactile:">=1.1.0",permissions:["native.embedded-webview"],entry:"plugin.jsx"};var o=globalThis.__TACTILE_PLUGIN_HOST__;if(!o)throw new Error("Tactile plugin host is unavailable.");var Y=o.React,J=o.React,_=o.React.Children,$=o.React.Component,oo=o.React.Fragment,eo=o.React.PureComponent,ro=o.React.cloneElement,ao=o.React.createContext,L=o.React.createElement,to=o.React.createRef,v=o.React.forwardRef,fo=o.React.isValidElement,lo=o.React.lazy,no=o.React.memo,so=o.React.startTransition,co=o.React.useContext,uo=o.createId,po=o.ObjectHeader,mo=o.ObjectGlyph,xo=o.PaperPortal,Io=o.useLocalDraft,io=o.codeLanguageForExtension,Co=o.resolveTauriInvoke,Fo=o.CODE_RUNTIME_TOOLS,go=o.getCodeRuntimeProfile,ho=o.setCodeRuntimePath,So=o.setCodeRuntimeSelected,Bo=o.setCodeRuntimeDiscovery,Do=o.subscribeCodeRuntimeProfile,Lo=o.objectTypeFor,bo=o.pluginAssetUrl,Po=o.installStyle,wo=o.React.useCallback,yo=o.React.useDeferredValue,Ao=o.React.useEffect,ko=o.React.useId,Mo=o.React.useLayoutEffect,Ro=o.React.useMemo,Oo=o.React.useReducer,vo=o.React.useRef,To=o.React.useState,Ho=o.React.useSyncExternalStore,No=o.React.useTransition;var T={outline:{xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"},filled:{xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"currentColor",stroke:"none"}};var B=(r,n,m,F)=>{let g=v(({color:c="currentColor",size:h=24,stroke:x=2,title:S,className:t,children:I,...D},u)=>L("svg",{ref:u,...T[r],width:h,height:h,className:["tabler-icon",`tabler-icon-${n}`,t].join(" "),...r==="filled"?{fill:c}:{strokeWidth:x,stroke:c},...D},[S&&L("title",{key:"svg-title"},S),...F.map(([p,s])=>L(p,s)),...Array.isArray(I)?I:[I]]));return g.displayName=`${m}`,g};var Z=[["path",{d:"M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6",key:"svg-0"}],["path",{d:"M11 13l9 -9",key:"svg-1"}],["path",{d:"M15 4h5v5",key:"svg-2"}]],b=B("outline","external-link","ExternalLink",Z);var Q=[["path",{d:"M19.933 13.041a8 8 0 1 1 -9.925 -8.788c3.899 -1 7.935 1.007 9.425 4.747",key:"svg-0"}],["path",{d:"M20 4v5h-5",key:"svg-1"}]],A=B("outline","reload","Reload",Q);var K=[["path",{d:"M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0",key:"svg-0"}],["path",{d:"M3.6 9h16.8",key:"svg-1"}],["path",{d:"M3.6 15h16.8",key:"svg-2"}],["path",{d:"M11.5 3a17 17 0 0 0 0 18",key:"svg-3"}],["path",{d:"M12.5 3a17 17 0 0 1 0 18",key:"svg-4"}]],k=B("outline","world","World",K);var e=globalThis.__TACTILE_PLUGIN_HOST__;if(!e)throw new Error("Tactile plugin host is unavailable.");var le=e.React,a=e.React,ne=e.React.Children,de=e.React.Component,se=e.React.Fragment,ce=e.React.PureComponent,ue=e.React.cloneElement,pe=e.React.createContext,me=e.React.createElement,xe=e.React.createRef,Ie=e.React.forwardRef,ie=e.React.isValidElement,Ce=e.React.lazy,Fe=e.React.memo,ge=e.React.startTransition,he=e.React.useContext,M=e.createId,H=e.ObjectHeader,P=e.ObjectGlyph,Se=e.PaperPortal,N=e.useLocalDraft,Be=e.codeLanguageForExtension,q=e.resolveTauriInvoke,De=e.CODE_RUNTIME_TOOLS,Le=e.getCodeRuntimeProfile,be=e.setCodeRuntimePath,Pe=e.setCodeRuntimeSelected,we=e.setCodeRuntimeDiscovery,ye=e.subscribeCodeRuntimeProfile,Ae=e.objectTypeFor,ke=e.pluginAssetUrl,E=e.installStyle,Me=e.React.useCallback,Re=e.React.useDeferredValue,U=e.React.useEffect,Oe=e.React.useId,ve=e.React.useLayoutEffect,W=e.React.useMemo,Te=e.React.useReducer,R=e.React.useRef,C=e.React.useState,He=e.React.useSyncExternalStore,Ne=e.React.useTransition;function G({url:r}){let n=R(null);n.current||(n.current=q());let m=n.current,F=!!m,[g,c]=C(null),[h,x]=C(!1),[S,t]=C(null),[I,D]=C(0),u=R(0);return U(()=>{if(!r){c(null),t(null),x(!1);return}let s=++u.current;return x(!0),t(null),m?m("workspace_fetch_webview",{url:r}).then(i=>{u.current===s&&c(String(i))}).catch(i=>{u.current===s&&(c(null),t(String(i||"Unable to load this address.")))}).finally(()=>{u.current===s&&x(!1)}):(c(r),x(!1)),()=>{u.current+=1}},[r,m,I]),{src:g,loading:h,error:S,native:F,reload:()=>D(s=>s+1)}}E(`.sites-object {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sites-workspace {
  width: calc(100% - 24px);
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-rows: 42px minmax(0, 1fr);
  margin: 10px 12px 11px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--paper-elevated);
  box-shadow: 0 9px 22px color-mix(in srgb, var(--elevation-shadow) 38%, transparent);
}

.sites-toolbar {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 3px 8px;
  border-bottom: 1px solid var(--line);
  background: var(--paper);
}

.sites-url-field {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sites-url-field input {
  width: 100%;
  min-width: 0;
  max-width: 680px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--paper-elevated);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 12px;
  outline: 0;
  caret-color: var(--accent);
}

.sites-url-field input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.sites-action {
  height: 26px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--muted);
  background: var(--paper-elevated);
  font-size: 9px;
  cursor: pointer;
}

.sites-action:hover,
.sites-action:focus-visible {
  outline: 0;
  color: var(--ink);
  border-color: var(--line-strong);
  background: var(--tray);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.sites-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.sites-external {
  color: var(--positive);
  border-color: color-mix(in srgb, var(--positive) 28%, var(--line));
  background: color-mix(in srgb, var(--positive) 7%, var(--paper-elevated));
}

.sites-stage {
  position: relative;
  min-width: 0;
  min-height: 0;
  background: var(--paper-elevated);
}

.sites-stage iframe {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  border: 0;
  background: white;
}

.sites-loading {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--accent) 5%, transparent), transparent 62%);
}

.sites-loading::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 42%;
  width: 22px;
  height: 22px;
  margin: -11px 0 0 -11px;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: sites-spin 0.8s linear infinite;
}

@keyframes sites-spin {
  to {
    transform: rotate(360deg);
  }
}

.sites-empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px;
  text-align: center;
  color: var(--muted);
}

.sites-empty-state > svg {
  color: var(--accent);
  opacity: 0.7;
}

.sites-empty-state h2 {
  margin: 4px 0 0;
  color: var(--ink);
  font-size: 15px;
  letter-spacing: -0.025em;
}

.sites-empty-state p {
  margin: 0;
  font-size: 9px;
  line-height: 1.55;
}`);function V({object:r,path:n,saveState:m,onUpdateObject:F,onBack:g,canGoBack:c,workspaceActions:h,onReparentObject:x,onOpenExternal:S}){let t=r.url||"",I=W(()=>{try{return new URL(t).hostname||t}catch{return t}},[t]),[D,u]=C(!1),p=N(t,f=>{let O=String(f||"").trim();O&&F?.({url:O})}),s=()=>{let f=String(p.draftRef.current||"").trim();f?p.commitDraft(f):p.cancelDraft()},{src:i,loading:w,error:y,reload:z}=G({url:t});return a.createElement("article",{className:"object-surface sites-object","data-object-type":"sites"},a.createElement(H,{object:r,path:n,saveState:m,onChange:F,onBack:g,canGoBack:c,workspaceActions:h,onReparentObject:x}),a.createElement("main",{className:"sites-workspace"},a.createElement("div",{className:"sites-toolbar","aria-label":"Site controls"},a.createElement("button",{type:"button",className:"sites-action",onClick:z,disabled:!t||w,"data-tooltip":"Reload site"},a.createElement(A,{size:13,stroke:1.6})," Reload"),a.createElement("label",{className:"sites-url-field"},a.createElement("span",{className:"visually-hidden"},"Site address"),a.createElement("input",{value:p.draft,placeholder:"https://example.com",spellCheck:"false",onChange:f=>p.updateDraft(f.target.value),onKeyDown:f=>{f.key==="Enter"&&(f.preventDefault(),s(),f.currentTarget.blur()),f.key==="Escape"&&(f.preventDefault(),p.cancelDraft(),f.currentTarget.blur())},onBlur:s})),a.createElement("button",{type:"button",className:"sites-action sites-external",onClick:()=>S?.(t),disabled:!t,"data-tooltip":"Open in your system browser"},a.createElement(b,{size:13,stroke:1.6})," Open in browser")),a.createElement("div",{className:"sites-stage"},t?i?a.createElement(a.Fragment,null,w&&!D?a.createElement("div",{className:"sites-loading","aria-hidden":"true"}):null,a.createElement("iframe",{key:i,title:r.title,src:i,referrerPolicy:"no-referrer",allow:"autoplay; clipboard-write; encrypted-media; fullscreen; geolocation; microphone; camera",onLoad:()=>u(!0)})):a.createElement("div",{className:"sites-empty-state"},a.createElement(P,{item:r,size:29,stroke:1.3}),a.createElement("h2",null,w?"Loading\u2026":y?"Unable to open this address":"No address yet"),a.createElement("p",null,y||"Enter an http or https address above to open it inside Tactile.")):a.createElement("div",{className:"sites-empty-state"},a.createElement(P,{item:r,size:29,stroke:1.3}),a.createElement("h2",null,"No address yet"),a.createElement("p",null,"Enter an http or https address above to open it inside Tactile.")))),a.createElement("footer",{className:"object-statusbar"},a.createElement("span",{className:"status-spacer"}),a.createElement("span",{className:"status-item"},a.createElement(P,{item:r,size:14,stroke:1.55})," Sites",I?` \xB7 ${I}`:""),a.createElement("span",{className:"status-divider"},"\xB7"),a.createElement("span",{className:"status-item keyboard-hint"},a.createElement(b,{size:14,stroke:1.6})," ",a.createElement("kbd",null,"[")," out")))}var d=l;function er(){return{type:d.type,label:d.name,description:d.description,icon:k,package:{id:d.packageId,version:d.version},renderer:{load:async()=>V},cell:{project:({object:r,fallbackValue:n})=>({displayValue:r?.title||r?.url||n||d.name})},create:(r={})=>({...r,id:r.id||M("sites"),type:d.type,title:r.title||"Untitled Site",description:r.description||"",parent:r.parent||null,url:r.url||""}),validate:r=>({valid:r?.type===d.type,errors:r?.type===d.type?[]:[`Object type must be ${d.type}.`]}),migrate:(r,n)=>({...r,id:r?.id||n||M("sites"),type:d.type,url:r?.url||""}),serialize:r=>r,deserialize:r=>r}}export{er as activate};
