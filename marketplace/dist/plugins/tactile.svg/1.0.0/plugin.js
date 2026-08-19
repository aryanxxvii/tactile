var f={schemaVersion:1,packageId:"tactile.svg",type:"svg",name:"SVG",description:"A locally attached vector image.",version:"1.0.0",tactile:">=1.1.0",permissions:[],entry:"plugin.jsx",extensions:["svg"],mimePrefixes:["image/svg+xml"]};var o=globalThis.__TACTILE_PLUGIN_HOST__;if(!o)throw new Error("Tactile plugin host is unavailable.");var G=o.React,V=o.React,z=o.React.Children,X=o.React.Component,Z=o.React.Fragment,Q=o.React.PureComponent,K=o.React.cloneElement,j=o.React.createContext,C=o.React.createElement,Y=o.React.createRef,P=o.React.forwardRef,J=o.React.isValidElement,_=o.React.lazy,$=o.React.memo,oo=o.React.startTransition,eo=o.React.useContext,ro=o.createId,ao=o.ObjectHeader,to=o.ObjectGlyph,fo=o.PaperPortal,lo=o.useLocalDraft,no=o.codeLanguageForExtension,so=o.resolveTauriInvoke,co=o.CODE_RUNTIME_TOOLS,uo=o.getCodeRuntimeProfile,po=o.setCodeRuntimePath,mo=o.setCodeRuntimeSelected,xo=o.setCodeRuntimeDiscovery,Io=o.subscribeCodeRuntimeProfile,io=o.objectTypeFor,Co=o.pluginAssetUrl,go=o.installStyle,Fo=o.React.useCallback,ho=o.React.useDeferredValue,So=o.React.useEffect,Bo=o.React.useId,Do=o.React.useLayoutEffect,bo=o.React.useMemo,Lo=o.React.useReducer,Po=o.React.useRef,wo=o.React.useState,yo=o.React.useSyncExternalStore,Ao=o.React.useTransition;var w={outline:{xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"},filled:{xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"currentColor",stroke:"none"}};var n=(r,s,c,a)=>{let d=P(({color:p="currentColor",size:m=24,stroke:g=2,title:x,className:F,children:l,...u},I)=>C("svg",{ref:I,...w[r],width:m,height:m,className:["tabler-icon",`tabler-icon-${s}`,F].join(" "),...r==="filled"?{fill:p}:{strokeWidth:g,stroke:p},...u},[x&&C("title",{key:"svg-title"},x),...a.map(([i,v])=>C(i,v)),...Array.isArray(l)?l:[l]]));return d.displayName=`${c}`,d};var T=[["path",{d:"M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2",key:"svg-0"}],["path",{d:"M7 11l5 5l5 -5",key:"svg-1"}],["path",{d:"M12 4l0 12",key:"svg-2"}]],h=n("outline","download","Download",T);var H=[["path",{d:"M14 3v4a1 1 0 0 0 1 1h4",key:"svg-0"}],["path",{d:"M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2",key:"svg-1"}],["path",{d:"M12 11v6",key:"svg-2"}],["path",{d:"M9.5 13.5l2.5 -2.5l2.5 2.5",key:"svg-3"}]],S=n("outline","file-upload","FileUpload",H);var N=[["path",{d:"M5 19l2.757 -7.351a1 1 0 0 1 .936 -.649h12.307a1 1 0 0 1 .986 1.164l-.996 5.211a2 2 0 0 1 -1.964 1.625h-14.026a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v2",key:"svg-0"}]],B=n("outline","folder-open","FolderOpen",N);var q=[["path",{d:"M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6",key:"svg-0"}],["path",{d:"M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0",key:"svg-1"}],["path",{d:"M8 11v-4a4 4 0 1 1 8 0v4",key:"svg-2"}]],D=n("outline","lock","Lock",q);var E=[["path",{d:"M3 15a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2",key:"svg-0"}],["path",{d:"M17 15a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2",key:"svg-1"}],["path",{d:"M10 7a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2",key:"svg-2"}],["path",{d:"M10 8.5a6 6 0 0 0 -5 5.5",key:"svg-3"}],["path",{d:"M14 8.5a6 6 0 0 1 5 5.5",key:"svg-4"}],["path",{d:"M10 8l-6 0",key:"svg-5"}],["path",{d:"M20 8l-6 0",key:"svg-6"}],["path",{d:"M2 8a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",key:"svg-7"}],["path",{d:"M20 8a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",key:"svg-8"}]],b=n("outline","vector-bezier","VectorBezier",E);var e=globalThis.__TACTILE_PLUGIN_HOST__;if(!e)throw new Error("Tactile plugin host is unavailable.");var le=e.React,t=e.React,ne=e.React.Children,de=e.React.Component,se=e.React.Fragment,ce=e.React.PureComponent,ue=e.React.cloneElement,pe=e.React.createContext,me=e.React.createElement,xe=e.React.createRef,Ie=e.React.forwardRef,ie=e.React.isValidElement,Ce=e.React.lazy,ge=e.React.memo,Fe=e.React.startTransition,he=e.React.useContext,L=e.createId,y=e.ObjectHeader,Se=e.ObjectGlyph,Be=e.PaperPortal,De=e.useLocalDraft,be=e.codeLanguageForExtension,Le=e.resolveTauriInvoke,Pe=e.CODE_RUNTIME_TOOLS,we=e.getCodeRuntimeProfile,ye=e.setCodeRuntimePath,Ae=e.setCodeRuntimeSelected,Me=e.setCodeRuntimeDiscovery,Re=e.subscribeCodeRuntimeProfile,ke=e.objectTypeFor,ve=e.pluginAssetUrl,A=e.installStyle,Oe=e.React.useCallback,Te=e.React.useDeferredValue,He=e.React.useEffect,Ne=e.React.useId,qe=e.React.useLayoutEffect,Ee=e.React.useMemo,Ue=e.React.useReducer,M=e.React.useRef,We=e.React.useState,Ge=e.React.useSyncExternalStore,Ve=e.React.useTransition;A(`.file-workspace {
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
`);function R(r,s,c){return{type:r.type,label:r.name,description:r.description,icon:c,package:{id:r.packageId,version:r.version},renderer:{load:async()=>s},cell:{project:({object:a,fallbackValue:d})=>({displayValue:a?.title||d||r.name})},create:(a={})=>({...a,id:a.id||L(r.type),type:r.type,title:a.title||`Untitled ${r.name}`,description:a.description||"",parent:a.parent||null,assetId:a.assetId||null,source:a.source||""}),validate:a=>({valid:a?.type===r.type,errors:a?.type===r.type?[]:[`Object type must be ${r.type}.`]}),migrate:(a,d)=>({...a,id:a?.id||d||L(r.type),type:r.type,assetId:a?.assetId||null,source:a?.source||""}),serialize:a=>a,deserialize:a=>a,assetPolicy:{kind:"external-asset",acceptsBinary:!0,extensions:r.extensions||[],mimePrefixes:r.mimePrefixes||[]}}}function k({object:r,path:s,saveState:c,onUpdateObject:a,onBack:d,canGoBack:p,workspaceActions:m,assets:g,onReplaceFile:x,onReparentObject:F}){let l=r.assetId?g?.[r.assetId]:null,u=M(null);return t.createElement("article",{className:"object-surface file-object","data-object-type":"svg"},t.createElement(y,{object:r,path:s,saveState:c,onChange:a,onBack:d,canGoBack:p,workspaceActions:m,onReparentObject:F}),t.createElement("main",{className:"file-workspace"},t.createElement("input",{ref:u,className:"native-file-input",type:"file",accept:".svg,image/svg+xml",tabIndex:-1,"aria-hidden":"true",onChange:I=>{let i=I.target.files?.[0];I.target.value="",i&&x?.(i)}}),t.createElement("div",{className:"file-toolbar"},t.createElement("span",{className:"file-ownership"},t.createElement(D,{size:13})," On this device"),t.createElement("span",{className:"file-meta"},l?.fileName||"SVG"),t.createElement("span",{className:"file-toolbar-spacer"}),t.createElement("button",{type:"button",onClick:()=>u.current?.click()},t.createElement(S,{size:13})," Replace"),l?.dataUrl?t.createElement("a",{href:l.dataUrl,download:l.fileName||r.title},t.createElement(h,{size:13})," Download"):null),t.createElement("div",{className:"file-stage"},l?.dataUrl?t.createElement("img",{src:l.dataUrl,alt:r.title}):t.createElement("div",{className:"file-empty-state"},t.createElement("h2",null,"Local content unavailable"),t.createElement("p",null,"Choose the SVG again to reconnect it."),t.createElement("button",{type:"button",onClick:()=>u.current?.click()},t.createElement(B,{size:14})," Choose SVG")))))}var U=f;function fr(){return R(U,k,b)}export{fr as activate};
