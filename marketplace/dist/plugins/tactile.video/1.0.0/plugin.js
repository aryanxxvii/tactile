var d={schemaVersion:1,packageId:"tactile.video",type:"video",name:"Video",description:"A locally attached video.",version:"1.0.0",tactile:">=1.1.0",permissions:["media.playback","media.picture-in-picture","media.fullscreen"],entry:"plugin.jsx",extensions:["mp4","webm"],mimePrefixes:["video/"]};var a=globalThis.__TACTILE_PLUGIN_HOST__;if(!a)throw new Error("Tactile plugin host is unavailable.");var ee=a.React,re=a.React,ae=a.React.Children,te=a.React.Component,fe=a.React.Fragment,le=a.React.PureComponent,ne=a.React.cloneElement,de=a.React.createContext,T=a.React.createElement,se=a.React.createRef,mo=a.React.forwardRef,ce=a.React.isValidElement,ue=a.React.lazy,pe=a.React.memo,me=a.React.startTransition,xe=a.React.useContext,Ie=a.createId,ie=a.ObjectHeader,Ce=a.ObjectGlyph,ge=a.PaperPortal,Fe=a.useLocalDraft,he=a.codeLanguageForExtension,Se=a.resolveTauriInvoke,Be=a.objectTypeFor,be=a.pluginAssetUrl,De=a.React.useCallback,Pe=a.React.useDeferredValue,Le=a.React.useEffect,ye=a.React.useId,ve=a.React.useLayoutEffect,ke=a.React.useMemo,we=a.React.useReducer,Me=a.React.useRef,Ae=a.React.useState,Re=a.React.useSyncExternalStore,Oe=a.React.useTransition;var xo={outline:{xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"},filled:{xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"currentColor",stroke:"none"}};var l=(n,p,I,r)=>{let s=mo(({color:i="currentColor",size:h=24,stroke:x=2,title:S,className:y,children:m,...c},b)=>T("svg",{ref:b,...xo[n],width:h,height:h,className:["tabler-icon",`tabler-icon-${p}`,y].join(" "),...n==="filled"?{fill:i}:{strokeWidth:x,stroke:i},...c},[S&&T("title",{key:"svg-title"},S),...r.map(([g,k])=>T(g,k)),...Array.isArray(m)?m:[m]]));return s.displayName=`${I}`,s};var Oo=[["path",{d:"M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2",key:"svg-0"}],["path",{d:"M7 11l5 5l5 -5",key:"svg-1"}],["path",{d:"M12 4l0 12",key:"svg-2"}]],z=l("outline","download","Download",Oo);var To=[["path",{d:"M14 3v4a1 1 0 0 0 1 1h4",key:"svg-0"}],["path",{d:"M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2",key:"svg-1"}],["path",{d:"M12 11v6",key:"svg-2"}],["path",{d:"M9.5 13.5l2.5 -2.5l2.5 2.5",key:"svg-3"}]],X=l("outline","file-upload","FileUpload",To);var Ho=[["path",{d:"M5 19l2.757 -7.351a1 1 0 0 1 .936 -.649h12.307a1 1 0 0 1 .986 1.164l-.996 5.211a2 2 0 0 1 -1.964 1.625h-14.026a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v2",key:"svg-0"}]],Z=l("outline","folder-open","FolderOpen",Ho);var No=[["path",{d:"M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6",key:"svg-0"}],["path",{d:"M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0",key:"svg-1"}],["path",{d:"M8 11v-4a4 4 0 1 1 8 0v4",key:"svg-2"}]],Q=l("outline","lock","Lock",No);var qo=[["path",{d:"M4 8v-2a2 2 0 0 1 2 -2h2",key:"svg-0"}],["path",{d:"M4 16v2a2 2 0 0 0 2 2h2",key:"svg-1"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v2",key:"svg-2"}],["path",{d:"M16 20h2a2 2 0 0 0 2 -2v-2",key:"svg-3"}]],K=l("outline","maximize","Maximize",qo);var Eo=[["path",{d:"M15 19v-2a2 2 0 0 1 2 -2h2",key:"svg-0"}],["path",{d:"M15 5v2a2 2 0 0 0 2 2h2",key:"svg-1"}],["path",{d:"M5 15h2a2 2 0 0 1 2 2v2",key:"svg-2"}],["path",{d:"M5 9h2a2 2 0 0 0 2 -2v-2",key:"svg-3"}]],j=l("outline","minimize","Minimize",Eo);var Uo=[["path",{d:"M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12",key:"svg-0"}],["path",{d:"M8 4l0 16",key:"svg-1"}],["path",{d:"M16 4l0 16",key:"svg-2"}],["path",{d:"M4 8l4 0",key:"svg-3"}],["path",{d:"M4 16l4 0",key:"svg-4"}],["path",{d:"M4 12l16 0",key:"svg-5"}],["path",{d:"M16 8l4 0",key:"svg-6"}],["path",{d:"M16 16l4 0",key:"svg-7"}]],_=l("outline","movie","Movie",Uo);var Wo=[["path",{d:"M11 19h-6a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v4",key:"svg-0"}],["path",{d:"M14 15a1 1 0 0 1 1 -1h5a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1l0 -3",key:"svg-1"}]],Y=l("outline","picture-in-picture","PictureInPicture",Wo);var Go=[["path",{d:"M6 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -12",key:"svg-0"}],["path",{d:"M14 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -12",key:"svg-1"}]],J=l("outline","player-pause","PlayerPause",Go);var Vo=[["path",{d:"M7 4v16l13 -8l-13 -8",key:"svg-0"}]],H=l("outline","player-play","PlayerPlay",Vo);var zo=[["path",{d:"M20 5v14l-12 -7l12 -7",key:"svg-0"}],["path",{d:"M4 5l0 14",key:"svg-1"}]],$=l("outline","player-skip-back","PlayerSkipBack",zo);var Xo=[["path",{d:"M3 5v14l8 -7l-8 -7",key:"svg-0"}],["path",{d:"M14 5v14l8 -7l-8 -7",key:"svg-1"}]],oo=l("outline","player-track-next","PlayerTrackNext",Xo);var Zo=[["path",{d:"M21 5v14l-8 -7l8 -7",key:"svg-0"}],["path",{d:"M10 5v14l-8 -7l8 -7",key:"svg-1"}]],eo=l("outline","player-track-prev","PlayerTrackPrev",Zo);var Qo=[["path",{d:"M15 8a5 5 0 0 1 0 8",key:"svg-0"}],["path",{d:"M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5",key:"svg-1"}]],ro=l("outline","volume-2","Volume2",Qo);var Ko=[["path",{d:"M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5",key:"svg-0"}],["path",{d:"M16 10l4 4m0 -4l-4 4",key:"svg-1"}]],ao=l("outline","volume-3","Volume3",Ko);var jo=[["path",{d:"M15 8a5 5 0 0 1 0 8",key:"svg-0"}],["path",{d:"M17.7 5a9 9 0 0 1 0 14",key:"svg-1"}],["path",{d:"M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5",key:"svg-2"}]],to=l("outline","volume","Volume",jo);var t=globalThis.__TACTILE_PLUGIN_HOST__;if(!t)throw new Error("Tactile plugin host is unavailable.");var ea=t.React,e=t.React,ra=t.React.Children,aa=t.React.Component,ta=t.React.Fragment,fa=t.React.PureComponent,la=t.React.cloneElement,na=t.React.createContext,da=t.React.createElement,sa=t.React.createRef,ca=t.React.forwardRef,ua=t.React.isValidElement,pa=t.React.lazy,ma=t.React.memo,xa=t.React.startTransition,Ia=t.React.useContext,fo=t.createId,Io=t.ObjectHeader,ia=t.ObjectGlyph,Ca=t.PaperPortal,ga=t.useLocalDraft,Fa=t.codeLanguageForExtension,ha=t.resolveTauriInvoke,Sa=t.objectTypeFor,Ba=t.pluginAssetUrl,C=t.React.useCallback,ba=t.React.useDeferredValue,N=t.React.useEffect,Da=t.React.useId,Pa=t.React.useLayoutEffect,io=t.React.useMemo,La=t.React.useReducer,L=t.React.useRef,u=t.React.useState,ya=t.React.useSyncExternalStore,va=t.React.useTransition;function Co(n,p,I){return{type:n.type,label:n.name,description:n.description,icon:I,package:{id:n.packageId,version:n.version},renderer:{load:async()=>p},cell:{project:({object:r,fallbackValue:s})=>({displayValue:r?.title||s||n.name})},create:(r={})=>({...r,id:r.id||fo(n.type),type:n.type,title:r.title||`Untitled ${n.name}`,description:r.description||"",parent:r.parent||null,assetId:r.assetId||null,source:r.source||""}),validate:r=>({valid:r?.type===n.type,errors:r?.type===n.type?[]:[`Object type must be ${n.type}.`]}),migrate:(r,s)=>({...r,id:r?.id||s||fo(n.type),type:n.type,assetId:r?.assetId||null,source:r?.source||""}),serialize:r=>r,deserialize:r=>r,assetPolicy:{kind:"external-asset",acceptsBinary:!0,extensions:n.extensions||[],mimePrefixes:n.mimePrefixes||[]}}}globalThis.__TACTILE_PLUGIN_HOST__.installStyle(`/* Video player. Loaded as a lazy CSS chunk alongside FileObject so it stays out\r
   of the entry CSS budget (see scripts/check-bundle-budget.mjs). */\r
\r
.video-player {\r
  width: 100%;\r
  height: 100%;\r
  min-width: 0;\r
  min-height: 0;\r
  display: grid;\r
  /* The stage takes the remaining space and the control lane is intrinsic, so\r
     the video can never push the controls out of the object. */\r
  grid-template-rows: minmax(0, 1fr) auto;\r
  overflow: hidden;\r
  background: #101010;\r
}\r
\r
.video-player:focus-visible {\r
  outline: 2px solid var(--focus-ring);\r
  outline-offset: -2px;\r
}\r
\r
.video-stage {\r
  position: relative;\r
  min-width: 0;\r
  min-height: 0;\r
  display: grid;\r
  place-items: center;\r
  overflow: hidden;\r
  cursor: pointer;\r
}\r
\r
/* Fit, never crop and never overflow: the element is bounded on both axes and\r
   keeps the intrinsic ratio reported by loadedmetadata, so tall videos shrink\r
   to the stage height instead of scrolling past the control lane. */\r
.video-stage > video {\r
  display: block;\r
  max-width: 100%;\r
  max-height: 100%;\r
  width: auto;\r
  height: auto;\r
  aspect-ratio: var(--video-aspect, 16 / 9);\r
  object-fit: contain;\r
  background: #000;\r
}\r
\r
.video-center-badge {\r
  position: absolute;\r
  top: 50%;\r
  left: 50%;\r
  width: 52px;\r
  height: 52px;\r
  display: grid;\r
  place-items: center;\r
  border-radius: 50%;\r
  color: #fff;\r
  background: color-mix(in srgb, #000 52%, transparent);\r
  box-shadow: 0 6px 22px color-mix(in srgb, #000 45%, transparent);\r
  transform: translate(-50%, -50%);\r
  pointer-events: none;\r
  backdrop-filter: blur(3px);\r
}\r
\r
.video-controls {\r
  display: grid;\r
  gap: 5px;\r
  padding: 6px 9px 8px;\r
  border-top: 1px solid color-mix(in srgb, #fff 12%, transparent);\r
  background: color-mix(in srgb, #000 78%, transparent);\r
  transition:\r
    opacity 160ms ease-out,\r
    transform 160ms ease-out;\r
}\r
\r
/* Chrome recedes only while playing; a paused player always shows its controls. */\r
.video-player[data-idle="true"] .video-controls {\r
  opacity: 0;\r
  transform: translateY(4px);\r
  pointer-events: none;\r
}\r
\r
.video-player[data-idle="true"] .video-stage {\r
  cursor: none;\r
}\r
\r
.video-scrub {\r
  position: relative;\r
  height: 14px;\r
  display: flex;\r
  align-items: center;\r
}\r
\r
.video-scrub-track {\r
  position: absolute;\r
  inset: auto 0;\r
  height: 4px;\r
  overflow: hidden;\r
  border-radius: 999px;\r
  background: color-mix(in srgb, #fff 20%, transparent);\r
}\r
\r
.video-scrub-buffered,\r
.video-scrub-played {\r
  position: absolute;\r
  inset: 0 auto 0 0;\r
  display: block;\r
  border-radius: 999px;\r
}\r
\r
.video-scrub-buffered {\r
  background: color-mix(in srgb, #fff 26%, transparent);\r
}\r
\r
.video-scrub-played {\r
  background: var(--accent);\r
}\r
\r
/* A real range input drives seeking so keyboard and assistive tech work; the\r
   painted track above is purely visual. */\r
.video-scrub-input {\r
  position: relative;\r
  width: 100%;\r
  height: 14px;\r
  margin: 0;\r
  appearance: none;\r
  background: transparent;\r
  cursor: pointer;\r
}\r
\r
.video-scrub-input::-webkit-slider-thumb {\r
  width: 11px;\r
  height: 11px;\r
  appearance: none;\r
  border: 0;\r
  border-radius: 50%;\r
  background: #fff;\r
  box-shadow: 0 1px 4px color-mix(in srgb, #000 60%, transparent);\r
}\r
\r
.video-scrub-input::-moz-range-thumb {\r
  width: 11px;\r
  height: 11px;\r
  border: 0;\r
  border-radius: 50%;\r
  background: #fff;\r
}\r
\r
.video-scrub-input:focus-visible {\r
  outline: 2px solid var(--focus-ring);\r
  outline-offset: 2px;\r
}\r
\r
.video-buttons {\r
  display: flex;\r
  align-items: center;\r
  gap: 4px;\r
  color: color-mix(in srgb, #fff 82%, transparent);\r
}\r
\r
.video-buttons button {\r
  width: 25px;\r
  height: 23px;\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  flex: 0 0 auto;\r
  padding: 0;\r
  border: 1px solid transparent;\r
  border-radius: 5px;\r
  color: inherit;\r
  background: transparent;\r
  cursor: pointer;\r
}\r
\r
.video-buttons button:hover,\r
.video-buttons button:focus-visible {\r
  outline: 0;\r
  color: #fff;\r
  border-color: color-mix(in srgb, #fff 22%, transparent);\r
  background: color-mix(in srgb, #fff 14%, transparent);\r
}\r
\r
.video-buttons button[aria-pressed="true"] {\r
  color: var(--accent);\r
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);\r
}\r
\r
.video-play {\r
  width: 28px !important;\r
  height: 25px !important;\r
  color: #fff !important;\r
  border-color: color-mix(in srgb, #fff 20%, transparent) !important;\r
  background: color-mix(in srgb, #fff 12%, transparent) !important;\r
}\r
\r
.video-time {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 3px;\r
  margin-left: 4px;\r
  padding-left: 7px;\r
  border-left: 1px solid color-mix(in srgb, #fff 16%, transparent);\r
  font-family: var(--font-mono);\r
  font-size: 8.5px;\r
  font-variant-numeric: tabular-nums;\r
  white-space: nowrap;\r
}\r
\r
.video-time-current {\r
  color: #fff;\r
}\r
.video-time-sep,\r
.video-time-total {\r
  color: color-mix(in srgb, #fff 55%, transparent);\r
}\r
\r
.video-volume {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 3px;\r
}\r
\r
/* The slider stays collapsed until the group is engaged so narrow objects keep\r
   every control reachable. */\r
.video-volume input {\r
  width: 0;\r
  height: 3px;\r
  margin: 0;\r
  appearance: none;\r
  border-radius: 999px;\r
  background: color-mix(in srgb, #fff 26%, transparent);\r
  opacity: 0;\r
  cursor: pointer;\r
  transition:\r
    width 140ms ease-out,\r
    opacity 140ms ease-out;\r
}\r
\r
.video-volume:hover input,\r
.video-volume:focus-within input {\r
  width: 54px;\r
  opacity: 1;\r
}\r
\r
.video-volume input::-webkit-slider-thumb {\r
  width: 9px;\r
  height: 9px;\r
  appearance: none;\r
  border: 0;\r
  border-radius: 50%;\r
  background: #fff;\r
}\r
\r
.video-volume input::-moz-range-thumb {\r
  width: 9px;\r
  height: 9px;\r
  border: 0;\r
  border-radius: 50%;\r
  background: #fff;\r
}\r
\r
.video-rate {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 4px;\r
  margin-left: 2px;\r
}\r
\r
.video-rate-caption {\r
  color: color-mix(in srgb, #fff 55%, transparent);\r
  font-size: 7.5px;\r
  font-weight: 700;\r
  letter-spacing: 0.075em;\r
  text-transform: uppercase;\r
}\r
\r
.video-rate select {\r
  height: 21px;\r
  padding: 0 3px;\r
  border: 1px solid color-mix(in srgb, #fff 20%, transparent);\r
  border-radius: 4px;\r
  color: #fff;\r
  background: color-mix(in srgb, #000 55%, transparent);\r
  font-family: var(--font-mono);\r
  font-size: 8.5px;\r
  cursor: pointer;\r
}\r
\r
.video-rate select:focus-visible {\r
  outline: 2px solid var(--focus-ring);\r
  outline-offset: 1px;\r
}\r
\r
/* Fullscreen has no object chrome to respect, so the stage takes the display. */\r
.video-player[data-fullscreen="true"] {\r
  background: #000;\r
}\r
\r
.video-player[data-fullscreen="true"] .video-controls {\r
  padding: 9px 16px 13px;\r
}\r
\r
@media (max-width: 900px) {\r
  .video-rate-caption,\r
  .video-time-total,\r
  .video-time-sep {\r
    display: none;\r
  }\r
}\r
\r
@media (prefers-reduced-motion: reduce) {\r
  .video-controls,\r
  .video-volume input {\r
    transition: none !important;\r
  }\r
}\r
`);var _o=[.25,.5,.75,1,1.25,1.5,1.75,2],B=5,Yo=1/30,Jo=2200;function q(n){if(!Number.isFinite(n)||n<0)return"0:00";let p=Math.floor(n),I=Math.floor(p/3600),r=Math.floor(p%3600/60),s=p%60,i=h=>String(h).padStart(2,"0");return I?`${I}:${i(r)}:${i(s)}`:`${r}:${i(s)}`}function go({src:n,title:p}){let I=L(null),r=L(null),s=L(0),[i,h]=u(!1),[x,S]=u(!1),[y,m]=u(!1),[c,b]=u(0),[g,k]=u(0),[ho,So]=u(0),[v,E]=u(1),[w,U]=u(!1),[Bo,lo]=u(1),[M,bo]=u(!1),[Do,no]=u(!1),[Po,A]=u(!1),[Lo,so]=u(!1),[co,yo]=u(0),W=io(()=>typeof document<"u"&&!!document.pictureInPictureEnabled,[]),R=C(()=>{A(!1),s.current&&window.clearTimeout(s.current),s.current=window.setTimeout(()=>A(!0),Jo)},[]);N(()=>()=>{s.current&&window.clearTimeout(s.current)},[]),N(()=>{x?R():(s.current&&window.clearTimeout(s.current),A(!1))},[x,R]);let O=C(()=>{let o=r.current;o&&(o.paused||o.ended?o.play().catch(()=>{}):o.pause())},[]),D=C(o=>{let f=r.current;if(!f||!Number.isFinite(o))return;let F=Number.isFinite(f.duration)?f.duration:0;f.currentTime=Math.min(F||o,Math.max(0,o)),k(f.currentTime)},[]),P=C(o=>{let f=r.current;f&&D(f.currentTime+o)},[D]),uo=C(o=>{let f=r.current;f&&(f.pause(),D(f.currentTime+o*Yo))},[D]),G=C(o=>{let f=r.current,F=Math.min(1,Math.max(0,o));f&&(f.volume=F,f.muted=F===0),E(F),U(F===0)},[]),po=C(()=>{let o=r.current;o&&(o.muted=!o.muted,U(o.muted),!o.muted&&o.volume===0&&(o.volume=.5,E(.5)))},[]),V=C(async()=>{let o=I.current;if(o)try{document.fullscreenElement?await document.exitFullscreen():await o.requestFullscreen()}catch{}},[]),vo=C(async()=>{let o=r.current;if(!(!o||!W))try{document.pictureInPictureElement?await document.exitPictureInPicture():await o.requestPictureInPicture()}catch{}},[W]);N(()=>{let o=()=>bo(!!document.fullscreenElement);return document.addEventListener("fullscreenchange",o),()=>document.removeEventListener("fullscreenchange",o)},[]);let ko=o=>{if(o.target instanceof HTMLInputElement)return;let F={" ":O,k:O,ArrowLeft:()=>P(-B),ArrowRight:()=>P(B),j:()=>P(-10),l:()=>P(10),ArrowUp:()=>G(v+.05),ArrowDown:()=>G(v-.05),m:po,f:V,Home:()=>D(0),End:()=>D(c),",":()=>uo(-1),".":()=>uo(1)}[o.key];F&&(o.preventDefault(),o.stopPropagation(),R(),F())},wo=c>0?g/c*100:0,Mo=c>0?Math.min(100,ho/c*100):0,Ao=w||v===0?ao:v<.5?ro:to;return e.createElement("div",{ref:I,className:"video-player","data-playing":x?"true":void 0,"data-idle":Po&&!Lo?"true":void 0,"data-fullscreen":M?"true":void 0,style:co?{"--video-aspect":co}:void 0,onMouseMove:R,onMouseLeave:()=>x&&A(!0),onKeyDown:ko,tabIndex:0,role:"group","aria-label":p?`${p} video player`:"Video player"},e.createElement("div",{className:"video-stage",onClick:O,onDoubleClick:V},e.createElement("video",{ref:r,src:n,preload:"metadata",playsInline:!0,"aria-label":p,onLoadedMetadata:o=>{let f=o.currentTarget;b(Number.isFinite(f.duration)?f.duration:0),f.videoWidth&&f.videoHeight&&yo(f.videoWidth/f.videoHeight),h(!0)},onTimeUpdate:o=>k(o.currentTarget.currentTime),onDurationChange:o=>{let f=o.currentTarget.duration;b(Number.isFinite(f)?f:0)},onProgress:o=>{let f=o.currentTarget.buffered;So(f.length?f.end(f.length-1):0)},onPlay:()=>{S(!0),m(!1)},onPause:()=>S(!1),onEnded:()=>{S(!1),m(!0)},onVolumeChange:o=>{E(o.currentTarget.volume),U(o.currentTarget.muted)},onRateChange:o=>lo(o.currentTarget.playbackRate),onEnterPictureInPicture:()=>no(!0),onLeavePictureInPicture:()=>no(!1)}),x?null:e.createElement("span",{className:"video-center-badge","aria-hidden":"true"},y?e.createElement($,{size:22,stroke:1.7}):e.createElement(H,{size:22,stroke:1.7}))),e.createElement("div",{className:"video-controls","aria-label":"Playback controls"},e.createElement("div",{className:"video-scrub"},e.createElement("div",{className:"video-scrub-track","aria-hidden":"true"},e.createElement("span",{className:"video-scrub-buffered",style:{width:`${Mo}%`}}),e.createElement("span",{className:"video-scrub-played",style:{width:`${wo}%`}})),e.createElement("input",{className:"video-scrub-input",type:"range",min:0,max:Number.isFinite(c)&&c>0?c:0,step:.01,value:Math.min(g,c||0),disabled:!i||!c,onChange:o=>D(Number(o.target.value)),onPointerDown:()=>so(!0),onPointerUp:()=>so(!1),"aria-label":"Seek","aria-valuetext":`${q(g)} of ${q(c)}`})),e.createElement("div",{className:"video-buttons"},e.createElement("button",{type:"button",onClick:()=>P(-B),"aria-label":`Back ${B} seconds`,"data-tooltip":`Back ${B}s`},e.createElement(eo,{size:13,stroke:1.7})),e.createElement("button",{type:"button",className:"video-play",onClick:O,"aria-label":x?"Pause":"Play","data-tooltip":x?"Pause":"Play"},x?e.createElement(J,{size:14,stroke:1.7}):e.createElement(H,{size:14,stroke:1.7})),e.createElement("button",{type:"button",onClick:()=>P(B),"aria-label":`Forward ${B} seconds`,"data-tooltip":`Forward ${B}s`},e.createElement(oo,{size:13,stroke:1.7})),e.createElement("span",{className:"video-time"},e.createElement("span",{className:"video-time-current"},q(g)),e.createElement("span",{className:"video-time-sep"},"/"),e.createElement("span",{className:"video-time-total"},q(c))),e.createElement("span",{className:"file-toolbar-spacer"}),e.createElement("span",{className:"video-volume"},e.createElement("button",{type:"button",onClick:po,"aria-label":w?"Unmute":"Mute","data-tooltip":w?"Unmute":"Mute"},e.createElement(Ao,{size:13,stroke:1.7})),e.createElement("input",{type:"range",min:0,max:1,step:.01,value:w?0:v,onChange:o=>G(Number(o.target.value)),"aria-label":"Volume"})),e.createElement("label",{className:"video-rate"},e.createElement("span",{className:"video-rate-caption"},"Speed"),e.createElement("select",{value:Bo,onChange:o=>{let f=Number(o.target.value);r.current&&(r.current.playbackRate=f),lo(f)},"aria-label":"Playback speed"},_o.map(o=>e.createElement("option",{key:o,value:o},o,"\xD7")))),W?e.createElement("button",{type:"button",onClick:vo,"aria-label":"Picture in picture","data-tooltip":"Picture in picture","aria-pressed":Do},e.createElement(Y,{size:13,stroke:1.7})):null,e.createElement("button",{type:"button",onClick:V,"aria-label":M?"Exit fullscreen":"Fullscreen","data-tooltip":M?"Exit fullscreen":"Fullscreen"},M?e.createElement(j,{size:13,stroke:1.7}):e.createElement(K,{size:13,stroke:1.7})))))}function Fo({object:n,path:p,saveState:I,onUpdateObject:r,onBack:s,canGoBack:i,workspaceActions:h,assets:x,onReplaceFile:S,onReparentObject:y}){let m=n.assetId?x?.[n.assetId]:null,c=L(null);return e.createElement("article",{className:"object-surface file-object","data-object-type":"video"},e.createElement(Io,{object:n,path:p,saveState:I,onChange:r,onBack:s,canGoBack:i,workspaceActions:h,onReparentObject:y}),e.createElement("main",{className:"file-workspace"},e.createElement("input",{ref:c,className:"native-file-input",type:"file",accept:"video/*",tabIndex:-1,"aria-hidden":"true",onChange:b=>{let g=b.target.files?.[0];b.target.value="",g&&S?.(g)}}),e.createElement("div",{className:"file-toolbar"},e.createElement("span",{className:"file-ownership"},e.createElement(Q,{size:13})," On this device"),e.createElement("span",{className:"file-meta"},m?.fileName||"Video"),e.createElement("span",{className:"file-toolbar-spacer"}),e.createElement("button",{type:"button",onClick:()=>c.current?.click()},e.createElement(X,{size:13})," Replace"),m?.dataUrl?e.createElement("a",{href:m.dataUrl,download:m.fileName||n.title},e.createElement(z,{size:13})," Download"):null),e.createElement("div",{className:"file-stage"},m?.dataUrl?e.createElement(go,{src:m.dataUrl,title:n.title}):e.createElement("div",{className:"file-empty-state"},e.createElement("h2",null,"Local content unavailable"),e.createElement("p",null,"Choose the video again to reconnect it."),e.createElement("button",{type:"button",onClick:()=>c.current?.click()},e.createElement(Z,{size:14})," Choose video")))))}var $o=d;function ja(){return Co($o,Fo,_)}export{ja as activate};
