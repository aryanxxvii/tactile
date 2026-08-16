var n={schemaVersion:1,packageId:"tactile.audio",type:"audio",name:"Audio",description:"A locally attached audio file.",version:"1.0.0",tactile:">=1.1.0",permissions:["media.playback"],entry:"plugin.jsx",extensions:["mp3","wav","ogg","flac","m4a","aac"],mimePrefixes:["audio/"]};var r=globalThis.__TACTILE_PLUGIN_HOST__;if(!r)throw new Error("Tactile plugin host is unavailable.");var Ao=r.React,Mo=r.React,vo=r.React.Children,Ro=r.React.Component,Oo=r.React.Fragment,To=r.React.PureComponent,Ho=r.React.cloneElement,No=r.React.createContext,w=r.React.createElement,qo=r.React.createRef,eo=r.React.forwardRef,Eo=r.React.isValidElement,Uo=r.React.lazy,Wo=r.React.memo,Go=r.React.startTransition,Vo=r.React.useContext,zo=r.createId,Xo=r.ObjectHeader,Zo=r.ObjectGlyph,Qo=r.PaperPortal,Ko=r.useLocalDraft,jo=r.codeLanguageForExtension,Yo=r.resolveTauriInvoke,_o=r.objectTypeFor,Jo=r.pluginAssetUrl,$o=r.React.useCallback,oe=r.React.useDeferredValue,ee=r.React.useEffect,re=r.React.useId,ae=r.React.useLayoutEffect,te=r.React.useMemo,fe=r.React.useReducer,le=r.React.useRef,ne=r.React.useState,de=r.React.useSyncExternalStore,se=r.React.useTransition;var ro={outline:{xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"},filled:{xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"currentColor",stroke:"none"}};var l=(t,u,s,f)=>{let x=eo(({color:m="currentColor",size:F=24,stroke:b=2,title:S,className:c,children:p,...I},B)=>w("svg",{ref:B,...ro[t],width:F,height:F,className:["tabler-icon",`tabler-icon-${u}`,c].join(" "),...t==="filled"?{fill:m}:{strokeWidth:b,stroke:m},...I},[S&&w("title",{key:"svg-title"},S),...f.map(([i,L])=>w(i,L)),...Array.isArray(p)?p:[p]]));return x.displayName=`${s}`,x};var xo=[["path",{d:"M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0",key:"svg-0"}],["path",{d:"M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",key:"svg-1"}],["path",{d:"M7 12a5 5 0 0 1 5 -5",key:"svg-2"}],["path",{d:"M12 17a5 5 0 0 0 5 -5",key:"svg-3"}]],H=l("outline","disc","Disc",xo);var Io=[["path",{d:"M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2",key:"svg-0"}],["path",{d:"M7 11l5 5l5 -5",key:"svg-1"}],["path",{d:"M12 4l0 12",key:"svg-2"}]],N=l("outline","download","Download",Io);var io=[["path",{d:"M14 3v4a1 1 0 0 0 1 1h4",key:"svg-0"}],["path",{d:"M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2",key:"svg-1"}],["path",{d:"M12 11v6",key:"svg-2"}],["path",{d:"M9.5 13.5l2.5 -2.5l2.5 2.5",key:"svg-3"}]],q=l("outline","file-upload","FileUpload",io);var Co=[["path",{d:"M5 19l2.757 -7.351a1 1 0 0 1 .936 -.649h12.307a1 1 0 0 1 .986 1.164l-.996 5.211a2 2 0 0 1 -1.964 1.625h-14.026a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v2",key:"svg-0"}]],E=l("outline","folder-open","FolderOpen",Co);var go=[["path",{d:"M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6",key:"svg-0"}],["path",{d:"M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0",key:"svg-1"}],["path",{d:"M8 11v-4a4 4 0 1 1 8 0v4",key:"svg-2"}]],U=l("outline","lock","Lock",go);var Fo=[["path",{d:"M3 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0",key:"svg-0"}],["path",{d:"M13 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0",key:"svg-1"}],["path",{d:"M9 17v-13h10v13",key:"svg-2"}],["path",{d:"M9 8h10",key:"svg-3"}]],W=l("outline","music","Music",Fo);var ho=[["path",{d:"M6 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -12",key:"svg-0"}],["path",{d:"M14 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -12",key:"svg-1"}]],G=l("outline","player-pause","PlayerPause",ho);var So=[["path",{d:"M7 4v16l13 -8l-13 -8",key:"svg-0"}]],V=l("outline","player-play","PlayerPlay",So);var Bo=[["path",{d:"M3 5v14l8 -7l-8 -7",key:"svg-0"}],["path",{d:"M14 5v14l8 -7l-8 -7",key:"svg-1"}]],z=l("outline","player-track-next","PlayerTrackNext",Bo);var Do=[["path",{d:"M21 5v14l-8 -7l8 -7",key:"svg-0"}],["path",{d:"M10 5v14l-8 -7l8 -7",key:"svg-1"}]],X=l("outline","player-track-prev","PlayerTrackPrev",Do);var bo=[["path",{d:"M4 12v-3a3 3 0 0 1 3 -3h13m-3 -3l3 3l-3 3",key:"svg-0"}],["path",{d:"M20 12v3a3 3 0 0 1 -3 3h-13m3 3l-3 -3l3 -3",key:"svg-1"}]],Z=l("outline","repeat","Repeat",bo);var Lo=[["path",{d:"M15 8a5 5 0 0 1 0 8",key:"svg-0"}],["path",{d:"M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5",key:"svg-1"}]],Q=l("outline","volume-2","Volume2",Lo);var Po=[["path",{d:"M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5",key:"svg-0"}],["path",{d:"M16 10l4 4m0 -4l-4 4",key:"svg-1"}]],K=l("outline","volume-3","Volume3",Po);var yo=[["path",{d:"M15 8a5 5 0 0 1 0 8",key:"svg-0"}],["path",{d:"M17.7 5a9 9 0 0 1 0 14",key:"svg-1"}],["path",{d:"M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5",key:"svg-2"}]],j=l("outline","volume","Volume",yo);var a=globalThis.__TACTILE_PLUGIN_HOST__;if(!a)throw new Error("Tactile plugin host is unavailable.");var Br=a.React,o=a.React,Dr=a.React.Children,br=a.React.Component,Lr=a.React.Fragment,Pr=a.React.PureComponent,yr=a.React.cloneElement,kr=a.React.createContext,wr=a.React.createElement,Ar=a.React.createRef,Mr=a.React.forwardRef,vr=a.React.isValidElement,Rr=a.React.lazy,Or=a.React.memo,Tr=a.React.startTransition,Hr=a.React.useContext,Y=a.createId,ao=a.ObjectHeader,Nr=a.ObjectGlyph,qr=a.PaperPortal,Er=a.useLocalDraft,Ur=a.codeLanguageForExtension,Wr=a.resolveTauriInvoke,Gr=a.objectTypeFor,Vr=a.pluginAssetUrl,h=a.React.useCallback,zr=a.React.useDeferredValue,Xr=a.React.useEffect,Zr=a.React.useId,Qr=a.React.useLayoutEffect,Kr=a.React.useMemo,jr=a.React.useReducer,A=a.React.useRef,C=a.React.useState,Yr=a.React.useSyncExternalStore,_r=a.React.useTransition;function to(t,u,s){return{type:t.type,label:t.name,description:t.description,icon:s,package:{id:t.packageId,version:t.version},renderer:{load:async()=>u},cell:{project:({object:f,fallbackValue:x})=>({displayValue:f?.title||x||t.name})},create:(f={})=>({...f,id:f.id||Y(t.type),type:t.type,title:f.title||`Untitled ${t.name}`,description:f.description||"",parent:f.parent||null,assetId:f.assetId||null,source:f.source||""}),validate:f=>({valid:f?.type===t.type,errors:f?.type===t.type?[]:[`Object type must be ${t.type}.`]}),migrate:(f,x)=>({...f,id:f?.id||x||Y(t.type),type:t.type,assetId:f?.assetId||null,source:f?.source||""}),serialize:f=>f,deserialize:f=>f,assetPolicy:{kind:"external-asset",acceptsBinary:!0,extensions:t.extensions||[],mimePrefixes:t.mimePrefixes||[]}}}globalThis.__TACTILE_PLUGIN_HOST__.installStyle(`/* Audio player. Loaded as a lazy CSS chunk alongside FileObject so it stays out\r
   of the entry CSS budget (see scripts/check-bundle-budget.mjs). */\r
\r
.audio-player {\r
  width: 100%;\r
  height: 100%;\r
  min-width: 0;\r
  min-height: 0;\r
  display: flex;\r
  flex-direction: column;\r
  align-items: stretch;\r
  justify-content: center;\r
  gap: 18px;\r
  padding: 30px 44px 34px;\r
  outline: 0;\r
  background: color-mix(in srgb, var(--paper-elevated) 72%, var(--paper));\r
}\r
\r
.audio-player:focus-visible {\r
  outline: 2px solid var(--focus-ring);\r
  outline-offset: -2px;\r
}\r
\r
.audio-art {\r
  position: relative;\r
  width: 128px;\r
  height: 128px;\r
  margin: 0 auto;\r
  display: grid;\r
  place-items: center;\r
  color: var(--accent);\r
}\r
\r
.audio-art-disc {\r
  position: relative;\r
  width: 96px;\r
  height: 96px;\r
  display: grid;\r
  place-items: center;\r
  border-radius: 50%;\r
  color: color-mix(in srgb, var(--accent) 78%, var(--ink));\r
  background: radial-gradient(circle at 30% 28%, var(--surface-highlight), transparent 45%);\r
  box-shadow:\r
    inset 0 0 0 1px var(--line),\r
    inset 0 1px 0 var(--surface-highlight),\r
    0 10px 26px var(--elevation-shadow);\r
}\r
\r
.audio-art-disc[data-playing="true"] {\r
  animation: audio-disc-spin 4s linear infinite;\r
  will-change: transform;\r
}\r
\r
@keyframes audio-disc-spin {\r
  to {\r
    transform: rotate(360deg);\r
  }\r
}\r
\r
.audio-art-center {\r
  position: absolute;\r
  width: 12px;\r
  height: 12px;\r
  border-radius: 50%;\r
  background: var(--paper);\r
  box-shadow: inset 0 0 0 1px var(--line-strong), 0 1px 3px var(--elevation-shadow);\r
}\r
\r
.audio-art-ring {\r
  position: absolute;\r
  inset: -4px;\r
  border-radius: 50%;\r
  border: 1px solid var(--line);\r
  opacity: 0.7;\r
  transition: transform 240ms ease-out;\r
}\r
\r
.audio-art-ring[data-playing="true"] {\r
  border-color: var(--accent);\r
  opacity: 0.9;\r
}\r
\r
.audio-meta {\r
  display: flex;\r
  flex-direction: column;\r
  align-items: center;\r
  gap: 3px;\r
}\r
\r
.audio-title {\r
  color: var(--ink);\r
  font-size: 14px;\r
  font-weight: 600;\r
  letter-spacing: -0.02em;\r
  text-align: center;\r
  max-width: 100%;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
\r
.audio-status {\r
  color: var(--muted);\r
  font-size: 9px;\r
  font-weight: 700;\r
  letter-spacing: 0.08em;\r
  text-transform: uppercase;\r
}\r
\r
.audio-scrub {\r
  display: flex;\r
  align-items: center;\r
  gap: 10px;\r
}\r
\r
.audio-scrub-track {\r
  position: relative;\r
  flex: 1 1 auto;\r
  height: 14px;\r
  display: flex;\r
  align-items: center;\r
  overflow: hidden;\r
}\r
\r
.audio-scrub-track::before {\r
  content: "";\r
  position: absolute;\r
  left: 0;\r
  right: 0;\r
  top: 50%;\r
  transform: translateY(-50%);\r
  height: 5px;\r
  border-radius: 999px;\r
  background: color-mix(in srgb, var(--line) 75%, transparent);\r
}\r
\r
.audio-scrub-played {\r
  position: absolute;\r
  inset: auto auto auto 0;\r
  top: 50%;\r
  transform: translateY(-50%);\r
  display: block;\r
  height: 5px;\r
  border-radius: 999px;\r
  background: var(--accent);\r
}\r
\r
.audio-scrub-input {\r
  position: relative;\r
  z-index: 1;\r
  width: 100%;\r
  height: 100%;\r
  margin: 0;\r
  appearance: none;\r
  background: transparent;\r
  cursor: pointer;\r
}\r
\r
.audio-scrub-input::-webkit-slider-thumb {\r
  width: 12px;\r
  height: 12px;\r
  appearance: none;\r
  border: 0;\r
  border-radius: 50%;\r
  background: var(--accent);\r
  box-shadow: 0 1px 4px var(--elevation-shadow);\r
}\r
\r
.audio-scrub-input::-moz-range-thumb {\r
  width: 12px;\r
  height: 12px;\r
  border: 0;\r
  border-radius: 50%;\r
  background: var(--accent);\r
}\r
\r
.audio-scrub-input:focus-visible {\r
  outline: 2px solid var(--focus-ring);\r
  outline-offset: 2px;\r
}\r
\r
.audio-time-current,\r
.audio-time-total {\r
  font-family: var(--font-mono);\r
  font-size: 9.5px;\r
  font-variant-numeric: tabular-nums;\r
  color: var(--muted);\r
  white-space: nowrap;\r
}\r
\r
.audio-buttons {\r
  display: flex;\r
  align-items: center;\r
  gap: 6px;\r
  justify-content: center;\r
  color: var(--ink);\r
}\r
\r
.audio-buttons button {\r
  width: 28px;\r
  height: 26px;\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  flex: 0 0 auto;\r
  padding: 0;\r
  border: 1px solid transparent;\r
  border-radius: 6px;\r
  color: var(--muted);\r
  background: transparent;\r
  cursor: pointer;\r
}\r
\r
.audio-buttons button:hover,\r
.audio-buttons button:focus-visible {\r
  outline: 0;\r
  color: var(--ink);\r
  border-color: var(--line-strong);\r
  background: color-mix(in srgb, var(--accent) 9%, var(--paper-elevated));\r
}\r
\r
.audio-buttons button[aria-pressed="true"] {\r
  color: var(--accent);\r
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));\r
}\r
\r
.audio-play {\r
  width: 34px !important;\r
  height: 32px !important;\r
  color: #fff !important;\r
  border-color: var(--accent) !important;\r
  background: var(--accent) !important;\r
  box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 42%, transparent);\r
}\r
\r
.audio-spacer {\r
  width: 10px;\r
}\r
\r
.audio-volume {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 3px;\r
}\r
\r
.audio-volume input {\r
  width: 0;\r
  height: 3px;\r
  margin: 0;\r
  appearance: none;\r
  border-radius: 999px;\r
  background: color-mix(in srgb, var(--line) 80%, transparent);\r
  opacity: 0;\r
  cursor: pointer;\r
  transition:\r
    width 140ms ease-out,\r
    opacity 140ms ease-out;\r
}\r
\r
.audio-volume:hover input,\r
.audio-volume:focus-within input {\r
  width: 58px;\r
  opacity: 1;\r
}\r
\r
.audio-volume input::-webkit-slider-thumb {\r
  width: 10px;\r
  height: 10px;\r
  appearance: none;\r
  border: 0;\r
  border-radius: 50%;\r
  background: var(--accent);\r
}\r
\r
.audio-volume input::-moz-range-thumb {\r
  width: 10px;\r
  height: 10px;\r
  border: 0;\r
  border-radius: 50%;\r
  background: var(--accent);\r
}\r
\r
.audio-rate-button {\r
  width: auto !important;\r
  padding: 0 9px !important;\r
  gap: 5px !important;\r
  align-items: center !important;\r
}\r
\r
.audio-rate-caption {\r
  color: var(--faint);\r
  font-size: 7.5px;\r
  font-weight: 700;\r
  letter-spacing: 0.08em;\r
  text-transform: uppercase;\r
}\r
\r
.audio-rate-value {\r
  color: var(--ink);\r
  font-family: var(--font-mono);\r
  font-size: 10px;\r
}\r
\r
@media (prefers-reduced-motion: reduce) {\r
  .audio-art-ring,\r
  .audio-art-disc[data-playing="true"],\r
  .audio-volume input {\r
    animation: none !important;\r
    transition: none !important;\r
  }\r
}`);var _=[.5,.75,1,1.25,1.5,1.75,2];function M(t){if(!Number.isFinite(t)||t<0)return"0:00";let u=Math.floor(t),s=Math.floor(u/60),f=u%60;return`${s}:${String(f).padStart(2,"0")}`}function fo({src:t,title:u}){let s=A(null),[f,x]=C(!1),[m,F]=C(!1),[b,S]=C(!1),[c,p]=C(0),[I,B]=C(0),[i,L]=C(1),[k,v]=C(!1),[P,J]=C(1),[R,no]=C(!1),O=h(()=>{let e=s.current;e&&(e.paused||e.ended?e.play().catch(()=>{}):e.pause())},[]),y=h(e=>{let d=s.current;if(!d||!Number.isFinite(e))return;let g=Number.isFinite(d.duration)?d.duration:0;d.currentTime=Math.min(g||e,Math.max(0,e)),B(d.currentTime)},[]),D=h(e=>{let d=s.current;d&&y(d.currentTime+e)},[y]),T=h(e=>{let d=s.current,g=Math.min(1,Math.max(0,e));d&&(d.volume=g,d.muted=g===0),L(g),v(g===0)},[]),$=h(()=>{let e=s.current;e&&(e.muted=!e.muted,v(e.muted),!e.muted&&e.volume===0&&(e.volume=.5,L(.5)))},[]),oo=h(()=>{let e=s.current;e&&(e.loop=!e.loop),no(!!e?.loop)},[]),so=h(()=>{let e=_[(_.indexOf(P)+1)%_.length];s.current&&(s.current.playbackRate=e),J(e)},[P]),co=e=>{if(e.target instanceof HTMLInputElement)return;let g={" ":O,k:O,ArrowLeft:()=>D(-5),ArrowRight:()=>D(5),j:()=>D(-10),l:()=>D(10),ArrowUp:()=>T(i+.05),ArrowDown:()=>T(i-.05),m:$,r:oo,Home:()=>y(0),End:()=>y(c)}[e.key];g&&(e.preventDefault(),e.stopPropagation(),g())},uo=c>0?I/c*100:0,po=k||i===0?K:i<.5?Q:j;return o.createElement("div",{className:"audio-player",onKeyDown:co,tabIndex:0,role:"group","aria-label":u?`${u} audio player`:"Audio player"},o.createElement("audio",{ref:s,src:t,preload:"metadata","aria-label":u,onLoadedMetadata:e=>{let d=e.currentTarget;p(Number.isFinite(d.duration)?d.duration:0),x(!0)},onTimeUpdate:e=>B(e.currentTarget.currentTime),onDurationChange:e=>{let d=e.currentTarget.duration;p(Number.isFinite(d)?d:0)},onPlay:()=>{F(!0),S(!1)},onPause:()=>F(!1),onEnded:()=>{F(!1),S(!0)},onVolumeChange:e=>{L(e.currentTarget.volume),v(e.currentTarget.muted)},onRateChange:e=>J(e.currentTarget.playbackRate)}),o.createElement("div",{className:"audio-art","aria-hidden":"true"},o.createElement("div",{className:"audio-art-disc","data-playing":m?"true":void 0},o.createElement(H,{size:34,stroke:1.3}),o.createElement("span",{className:"audio-art-center"})),o.createElement("span",{className:"audio-art-ring","data-playing":m?"true":void 0})),o.createElement("div",{className:"audio-meta"},o.createElement("span",{className:"audio-title"},u||"Audio"),o.createElement("span",{className:"audio-status"},b?"Ended":m?"Playing":f?"Paused":"Loading\u2026")),o.createElement("div",{className:"audio-scrub"},o.createElement("span",{className:"audio-time-current"},M(I)),o.createElement("div",{className:"audio-scrub-track"},o.createElement("span",{className:"audio-scrub-played",style:{width:`${uo}%`},"aria-hidden":"true"}),o.createElement("input",{className:"audio-scrub-input",type:"range",min:0,max:Number.isFinite(c)&&c>0?c:0,step:.01,value:Math.min(I,c||0),disabled:!f||!c,onChange:e=>y(Number(e.target.value)),"aria-label":"Seek","aria-valuetext":`${M(I)} of ${M(c)}`})),o.createElement("span",{className:"audio-time-total"},M(c))),o.createElement("div",{className:"audio-buttons"},o.createElement("button",{type:"button",onClick:()=>D(-10),"aria-label":"Back 10 seconds","data-tooltip":"Back 10s"},o.createElement(X,{size:14,stroke:1.7})),o.createElement("button",{type:"button",className:"audio-play",onClick:O,"aria-label":m?"Pause":"Play","data-tooltip":m?"Pause":"Play"},m?o.createElement(G,{size:15,stroke:1.7}):o.createElement(V,{size:15,stroke:1.7})),o.createElement("button",{type:"button",onClick:()=>D(10),"aria-label":"Forward 10 seconds","data-tooltip":"Forward 10s"},o.createElement(z,{size:14,stroke:1.7})),o.createElement("span",{className:"audio-spacer"}),o.createElement("button",{type:"button",onClick:oo,"aria-label":R?"Turn repeat off":"Repeat","data-tooltip":R?"Repeat on":"Repeat","aria-pressed":R},o.createElement(Z,{size:14,stroke:1.7})),o.createElement("span",{className:"audio-volume"},o.createElement("button",{type:"button",onClick:$,"aria-label":k?"Unmute":"Mute","data-tooltip":k?"Unmute":"Mute"},o.createElement(po,{size:14,stroke:1.7})),o.createElement("input",{type:"range",min:0,max:1,step:.01,value:k?0:i,onChange:e=>T(Number(e.target.value)),"aria-label":"Volume"})),o.createElement("button",{type:"button",className:"audio-rate-button",onClick:so,"aria-label":`Playback speed ${P}\xD7`,"data-tooltip":`Speed ${P}\xD7`},o.createElement("span",{className:"audio-rate-caption"},"Speed"),o.createElement("span",{className:"audio-rate-value"},P,"\xD7"))))}function lo({object:t,path:u,saveState:s,onUpdateObject:f,onBack:x,canGoBack:m,workspaceActions:F,assets:b,onReplaceFile:S,onReparentObject:c}){let p=t.assetId?b?.[t.assetId]:null,I=A(null);return o.createElement("article",{className:"object-surface file-object","data-object-type":"audio"},o.createElement(ao,{object:t,path:u,saveState:s,onChange:f,onBack:x,canGoBack:m,workspaceActions:F,onReparentObject:c}),o.createElement("main",{className:"file-workspace"},o.createElement("input",{ref:I,className:"native-file-input",type:"file",accept:"audio/*",tabIndex:-1,"aria-hidden":"true",onChange:B=>{let i=B.target.files?.[0];B.target.value="",i&&S?.(i)}}),o.createElement("div",{className:"file-toolbar"},o.createElement("span",{className:"file-ownership"},o.createElement(U,{size:13})," On this device"),o.createElement("span",{className:"file-meta"},p?.fileName||"Audio"),o.createElement("span",{className:"file-toolbar-spacer"}),o.createElement("button",{type:"button",onClick:()=>I.current?.click()},o.createElement(q,{size:13})," Replace"),p?.dataUrl?o.createElement("a",{href:p.dataUrl,download:p.fileName||t.title},o.createElement(N,{size:13})," Download"):null),o.createElement("div",{className:"file-stage"},p?.dataUrl?o.createElement(fo,{src:p.dataUrl,title:t.title}):o.createElement("div",{className:"file-empty-state"},o.createElement("h2",null,"Local content unavailable"),o.createElement("p",null,"Choose the audio file again to reconnect it."),o.createElement("button",{type:"button",onClick:()=>I.current?.click()},o.createElement(E,{size:14})," Choose audio")))))}var ko=n;function ha(){return to(ko,lo,W)}export{ha as activate};
