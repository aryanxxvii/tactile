var d={schemaVersion:1,packageId:"tactile.video",type:"video",name:"Video",description:"A locally attached video.",version:"1.0.0",tactile:">=1.1.0",permissions:["media.playback","media.picture-in-picture","media.fullscreen"],entry:"plugin.jsx",extensions:["mp4","webm"],mimePrefixes:["video/"]};var r=globalThis.__TACTILE_PLUGIN_HOST__;if(!r)throw new Error("Tactile plugin host is unavailable.");var re=r.React,ae=r.React,te=r.React.Children,fe=r.React.Component,le=r.React.Fragment,ne=r.React.PureComponent,de=r.React.cloneElement,se=r.React.createContext,T=r.React.createElement,ce=r.React.createRef,xo=r.React.forwardRef,ue=r.React.isValidElement,pe=r.React.lazy,me=r.React.memo,xe=r.React.startTransition,Ie=r.React.useContext,ie=r.createId,ge=r.ObjectHeader,Ce=r.ObjectGlyph,he=r.PaperPortal,Fe=r.useLocalDraft,Se=r.codeLanguageForExtension,Be=r.resolveTauriInvoke,be=r.CODE_RUNTIME_TOOLS,De=r.getCodeRuntimeProfile,Pe=r.setCodeRuntimePath,ve=r.setCodeRuntimeSelected,ye=r.setCodeRuntimeDiscovery,Le=r.subscribeCodeRuntimeProfile,ke=r.objectTypeFor,we=r.pluginAssetUrl,Me=r.installStyle,Ae=r.React.useCallback,Re=r.React.useDeferredValue,Oe=r.React.useEffect,Te=r.React.useId,He=r.React.useLayoutEffect,Ne=r.React.useMemo,qe=r.React.useReducer,Ee=r.React.useRef,Ue=r.React.useState,We=r.React.useSyncExternalStore,Ge=r.React.useTransition;var Io={outline:{xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"},filled:{xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"currentColor",stroke:"none"}};var l=(n,p,I,t)=>{let s=xo(({color:i="currentColor",size:F=24,stroke:x=2,title:S,className:y,children:m,...c},b)=>T("svg",{ref:b,...Io[n],width:F,height:F,className:["tabler-icon",`tabler-icon-${p}`,y].join(" "),...n==="filled"?{fill:i}:{strokeWidth:x,stroke:i},...c},[S&&T("title",{key:"svg-title"},S),...t.map(([C,k])=>T(C,k)),...Array.isArray(m)?m:[m]]));return s.displayName=`${I}`,s};var To=[["path",{d:"M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2",key:"svg-0"}],["path",{d:"M7 11l5 5l5 -5",key:"svg-1"}],["path",{d:"M12 4l0 12",key:"svg-2"}]],X=l("outline","download","Download",To);var Ho=[["path",{d:"M14 3v4a1 1 0 0 0 1 1h4",key:"svg-0"}],["path",{d:"M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2",key:"svg-1"}],["path",{d:"M12 11v6",key:"svg-2"}],["path",{d:"M9.5 13.5l2.5 -2.5l2.5 2.5",key:"svg-3"}]],Z=l("outline","file-upload","FileUpload",Ho);var No=[["path",{d:"M5 19l2.757 -7.351a1 1 0 0 1 .936 -.649h12.307a1 1 0 0 1 .986 1.164l-.996 5.211a2 2 0 0 1 -1.964 1.625h-14.026a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v2",key:"svg-0"}]],Q=l("outline","folder-open","FolderOpen",No);var qo=[["path",{d:"M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6",key:"svg-0"}],["path",{d:"M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0",key:"svg-1"}],["path",{d:"M8 11v-4a4 4 0 1 1 8 0v4",key:"svg-2"}]],K=l("outline","lock","Lock",qo);var Eo=[["path",{d:"M4 8v-2a2 2 0 0 1 2 -2h2",key:"svg-0"}],["path",{d:"M4 16v2a2 2 0 0 0 2 2h2",key:"svg-1"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v2",key:"svg-2"}],["path",{d:"M16 20h2a2 2 0 0 0 2 -2v-2",key:"svg-3"}]],j=l("outline","maximize","Maximize",Eo);var Uo=[["path",{d:"M15 19v-2a2 2 0 0 1 2 -2h2",key:"svg-0"}],["path",{d:"M15 5v2a2 2 0 0 0 2 2h2",key:"svg-1"}],["path",{d:"M5 15h2a2 2 0 0 1 2 2v2",key:"svg-2"}],["path",{d:"M5 9h2a2 2 0 0 0 2 -2v-2",key:"svg-3"}]],_=l("outline","minimize","Minimize",Uo);var Wo=[["path",{d:"M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12",key:"svg-0"}],["path",{d:"M8 4l0 16",key:"svg-1"}],["path",{d:"M16 4l0 16",key:"svg-2"}],["path",{d:"M4 8l4 0",key:"svg-3"}],["path",{d:"M4 16l4 0",key:"svg-4"}],["path",{d:"M4 12l16 0",key:"svg-5"}],["path",{d:"M16 8l4 0",key:"svg-6"}],["path",{d:"M16 16l4 0",key:"svg-7"}]],Y=l("outline","movie","Movie",Wo);var Go=[["path",{d:"M11 19h-6a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v4",key:"svg-0"}],["path",{d:"M14 15a1 1 0 0 1 1 -1h5a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1l0 -3",key:"svg-1"}]],J=l("outline","picture-in-picture","PictureInPicture",Go);var Vo=[["path",{d:"M6 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -12",key:"svg-0"}],["path",{d:"M14 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -12",key:"svg-1"}]],$=l("outline","player-pause","PlayerPause",Vo);var zo=[["path",{d:"M7 4v16l13 -8l-13 -8",key:"svg-0"}]],H=l("outline","player-play","PlayerPlay",zo);var Xo=[["path",{d:"M20 5v14l-12 -7l12 -7",key:"svg-0"}],["path",{d:"M4 5l0 14",key:"svg-1"}]],oo=l("outline","player-skip-back","PlayerSkipBack",Xo);var Zo=[["path",{d:"M3 5v14l8 -7l-8 -7",key:"svg-0"}],["path",{d:"M14 5v14l8 -7l-8 -7",key:"svg-1"}]],eo=l("outline","player-track-next","PlayerTrackNext",Zo);var Qo=[["path",{d:"M21 5v14l-8 -7l8 -7",key:"svg-0"}],["path",{d:"M10 5v14l-8 -7l8 -7",key:"svg-1"}]],ro=l("outline","player-track-prev","PlayerTrackPrev",Qo);var Ko=[["path",{d:"M15 8a5 5 0 0 1 0 8",key:"svg-0"}],["path",{d:"M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5",key:"svg-1"}]],ao=l("outline","volume-2","Volume2",Ko);var jo=[["path",{d:"M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5",key:"svg-0"}],["path",{d:"M16 10l4 4m0 -4l-4 4",key:"svg-1"}]],to=l("outline","volume-3","Volume3",jo);var _o=[["path",{d:"M15 8a5 5 0 0 1 0 8",key:"svg-0"}],["path",{d:"M17.7 5a9 9 0 0 1 0 14",key:"svg-1"}],["path",{d:"M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5",key:"svg-2"}]],fo=l("outline","volume","Volume",_o);var a=globalThis.__TACTILE_PLUGIN_HOST__;if(!a)throw new Error("Tactile plugin host is unavailable.");var sa=a.React,e=a.React,ca=a.React.Children,ua=a.React.Component,pa=a.React.Fragment,ma=a.React.PureComponent,xa=a.React.cloneElement,Ia=a.React.createContext,ia=a.React.createElement,ga=a.React.createRef,Ca=a.React.forwardRef,ha=a.React.isValidElement,Fa=a.React.lazy,Sa=a.React.memo,Ba=a.React.startTransition,ba=a.React.useContext,lo=a.createId,io=a.ObjectHeader,Da=a.ObjectGlyph,Pa=a.PaperPortal,va=a.useLocalDraft,ya=a.codeLanguageForExtension,La=a.resolveTauriInvoke,ka=a.CODE_RUNTIME_TOOLS,wa=a.getCodeRuntimeProfile,Ma=a.setCodeRuntimePath,Aa=a.setCodeRuntimeSelected,Ra=a.setCodeRuntimeDiscovery,Oa=a.subscribeCodeRuntimeProfile,Ta=a.objectTypeFor,Ha=a.pluginAssetUrl,N=a.installStyle,g=a.React.useCallback,Na=a.React.useDeferredValue,q=a.React.useEffect,qa=a.React.useId,Ea=a.React.useLayoutEffect,go=a.React.useMemo,Ua=a.React.useReducer,v=a.React.useRef,u=a.React.useState,Wa=a.React.useSyncExternalStore,Ga=a.React.useTransition;N(`.file-workspace {
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
`);function Co(n,p,I){return{type:n.type,label:n.name,description:n.description,icon:I,package:{id:n.packageId,version:n.version},renderer:{load:async()=>p},cell:{project:({object:t,fallbackValue:s})=>({displayValue:t?.title||s||n.name})},create:(t={})=>({...t,id:t.id||lo(n.type),type:n.type,title:t.title||`Untitled ${n.name}`,description:t.description||"",parent:t.parent||null,assetId:t.assetId||null,source:t.source||""}),validate:t=>({valid:t?.type===n.type,errors:t?.type===n.type?[]:[`Object type must be ${n.type}.`]}),migrate:(t,s)=>({...t,id:t?.id||s||lo(n.type),type:n.type,assetId:t?.assetId||null,source:t?.source||""}),serialize:t=>t,deserialize:t=>t,assetPolicy:{kind:"external-asset",acceptsBinary:!0,extensions:n.extensions||[],mimePrefixes:n.mimePrefixes||[]}}}N(`/* Video player. Loaded as a lazy CSS chunk alongside FileObject so it stays out
   of the entry CSS budget (see scripts/check-bundle-budget.mjs). */

.video-player {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: grid;
  /* The stage takes the remaining space and the control lane is intrinsic, so
     the video can never push the controls out of the object. */
  grid-template-rows: minmax(0, 1fr) auto;
  overflow: hidden;
  background: #101010;
}

.video-player:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}

.video-stage {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  cursor: pointer;
}

/* Fit, never crop and never overflow: the element is bounded on both axes and
   keeps the intrinsic ratio reported by loadedmetadata, so tall videos shrink
   to the stage height instead of scrolling past the control lane. */
.video-stage > video {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  aspect-ratio: var(--video-aspect, 16 / 9);
  object-fit: contain;
  background: #000;
}

.video-center-badge {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: color-mix(in srgb, #000 52%, transparent);
  box-shadow: 0 6px 22px color-mix(in srgb, #000 45%, transparent);
  transform: translate(-50%, -50%);
  pointer-events: none;
  backdrop-filter: blur(3px);
}

.video-controls {
  display: grid;
  gap: 5px;
  padding: 6px 9px 8px;
  border-top: 1px solid color-mix(in srgb, #fff 12%, transparent);
  background: color-mix(in srgb, #000 78%, transparent);
  transition:
    opacity 160ms ease-out,
    transform 160ms ease-out;
}

/* Chrome recedes only while playing; a paused player always shows its controls. */
.video-player[data-idle="true"] .video-controls {
  opacity: 0;
  transform: translateY(4px);
  pointer-events: none;
}

.video-player[data-idle="true"] .video-stage {
  cursor: none;
}

.video-scrub {
  position: relative;
  height: 14px;
  display: flex;
  align-items: center;
}

.video-scrub-track {
  position: absolute;
  inset: auto 0;
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, #fff 20%, transparent);
}

.video-scrub-buffered,
.video-scrub-played {
  position: absolute;
  inset: 0 auto 0 0;
  display: block;
  border-radius: 999px;
}

.video-scrub-buffered {
  background: color-mix(in srgb, #fff 26%, transparent);
}

.video-scrub-played {
  background: var(--accent);
}

/* A real range input drives seeking so keyboard and assistive tech work; the
   painted track above is purely visual. */
.video-scrub-input {
  position: relative;
  width: 100%;
  height: 14px;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

.video-scrub-input::-webkit-slider-thumb {
  width: 11px;
  height: 11px;
  appearance: none;
  border: 0;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px color-mix(in srgb, #000 60%, transparent);
}

.video-scrub-input::-moz-range-thumb {
  width: 11px;
  height: 11px;
  border: 0;
  border-radius: 50%;
  background: #fff;
}

.video-scrub-input:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.video-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
  color: color-mix(in srgb, #fff 82%, transparent);
}

.video-buttons button {
  width: 25px;
  height: 23px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 5px;
  color: inherit;
  background: transparent;
  cursor: pointer;
}

.video-buttons button:hover,
.video-buttons button:focus-visible {
  outline: 0;
  color: #fff;
  border-color: color-mix(in srgb, #fff 22%, transparent);
  background: color-mix(in srgb, #fff 14%, transparent);
}

.video-buttons button[aria-pressed="true"] {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
}

.video-play {
  width: 28px !important;
  height: 25px !important;
  color: #fff !important;
  border-color: color-mix(in srgb, #fff 20%, transparent) !important;
  background: color-mix(in srgb, #fff 12%, transparent) !important;
}

.video-time {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 4px;
  padding-left: 7px;
  border-left: 1px solid color-mix(in srgb, #fff 16%, transparent);
  font-family: var(--font-mono);
  font-size: 8.5px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.video-time-current {
  color: #fff;
}
.video-time-sep,
.video-time-total {
  color: color-mix(in srgb, #fff 55%, transparent);
}

.video-volume {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

/* The slider stays collapsed until the group is engaged so narrow objects keep
   every control reachable. */
.video-volume input {
  width: 0;
  height: 3px;
  margin: 0;
  appearance: none;
  border-radius: 999px;
  background: color-mix(in srgb, #fff 26%, transparent);
  opacity: 0;
  cursor: pointer;
  transition:
    width 140ms ease-out,
    opacity 140ms ease-out;
}

.video-volume:hover input,
.video-volume:focus-within input {
  width: 54px;
  opacity: 1;
}

.video-volume input::-webkit-slider-thumb {
  width: 9px;
  height: 9px;
  appearance: none;
  border: 0;
  border-radius: 50%;
  background: #fff;
}

.video-volume input::-moz-range-thumb {
  width: 9px;
  height: 9px;
  border: 0;
  border-radius: 50%;
  background: #fff;
}

.video-rate {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 2px;
}

.video-rate-caption {
  color: color-mix(in srgb, #fff 55%, transparent);
  font-size: 7.5px;
  font-weight: 700;
  letter-spacing: 0.075em;
  text-transform: uppercase;
}

.video-rate select {
  height: 21px;
  padding: 0 3px;
  border: 1px solid color-mix(in srgb, #fff 20%, transparent);
  border-radius: 4px;
  color: #fff;
  background: color-mix(in srgb, #000 55%, transparent);
  font-family: var(--font-mono);
  font-size: 8.5px;
  cursor: pointer;
}

.video-rate select:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}

/* Fullscreen has no object chrome to respect, so the stage takes the display. */
.video-player[data-fullscreen="true"] {
  background: #000;
}

.video-player[data-fullscreen="true"] .video-controls {
  padding: 9px 16px 13px;
}

@media (max-width: 900px) {
  .video-rate-caption,
  .video-time-total,
  .video-time-sep {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .video-controls,
  .video-volume input {
    transition: none !important;
  }
}
`);var Yo=[.25,.5,.75,1,1.25,1.5,1.75,2],B=5,Jo=1/30,$o=2200;function E(n){if(!Number.isFinite(n)||n<0)return"0:00";let p=Math.floor(n),I=Math.floor(p/3600),t=Math.floor(p%3600/60),s=p%60,i=F=>String(F).padStart(2,"0");return I?`${I}:${i(t)}:${i(s)}`:`${t}:${i(s)}`}function ho({src:n,title:p}){let I=v(null),t=v(null),s=v(0),[i,F]=u(!1),[x,S]=u(!1),[y,m]=u(!1),[c,b]=u(0),[C,k]=u(0),[So,Bo]=u(0),[L,U]=u(1),[w,W]=u(!1),[bo,no]=u(1),[M,Do]=u(!1),[Po,so]=u(!1),[vo,A]=u(!1),[yo,co]=u(!1),[uo,Lo]=u(0),G=go(()=>typeof document<"u"&&!!document.pictureInPictureEnabled,[]),R=g(()=>{A(!1),s.current&&window.clearTimeout(s.current),s.current=window.setTimeout(()=>A(!0),$o)},[]);q(()=>()=>{s.current&&window.clearTimeout(s.current)},[]),q(()=>{x?R():(s.current&&window.clearTimeout(s.current),A(!1))},[x,R]);let O=g(()=>{let o=t.current;o&&(o.paused||o.ended?o.play().catch(()=>{}):o.pause())},[]),D=g(o=>{let f=t.current;if(!f||!Number.isFinite(o))return;let h=Number.isFinite(f.duration)?f.duration:0;f.currentTime=Math.min(h||o,Math.max(0,o)),k(f.currentTime)},[]),P=g(o=>{let f=t.current;f&&D(f.currentTime+o)},[D]),po=g(o=>{let f=t.current;f&&(f.pause(),D(f.currentTime+o*Jo))},[D]),V=g(o=>{let f=t.current,h=Math.min(1,Math.max(0,o));f&&(f.volume=h,f.muted=h===0),U(h),W(h===0)},[]),mo=g(()=>{let o=t.current;o&&(o.muted=!o.muted,W(o.muted),!o.muted&&o.volume===0&&(o.volume=.5,U(.5)))},[]),z=g(async()=>{let o=I.current;if(o)try{document.fullscreenElement?await document.exitFullscreen():await o.requestFullscreen()}catch{}},[]),ko=g(async()=>{let o=t.current;if(!(!o||!G))try{document.pictureInPictureElement?await document.exitPictureInPicture():await o.requestPictureInPicture()}catch{}},[G]);q(()=>{let o=()=>Do(!!document.fullscreenElement);return document.addEventListener("fullscreenchange",o),()=>document.removeEventListener("fullscreenchange",o)},[]);let wo=o=>{if(o.target instanceof HTMLInputElement)return;let h={" ":O,k:O,ArrowLeft:()=>P(-B),ArrowRight:()=>P(B),j:()=>P(-10),l:()=>P(10),ArrowUp:()=>V(L+.05),ArrowDown:()=>V(L-.05),m:mo,f:z,Home:()=>D(0),End:()=>D(c),",":()=>po(-1),".":()=>po(1)}[o.key];h&&(o.preventDefault(),o.stopPropagation(),R(),h())},Mo=c>0?C/c*100:0,Ao=c>0?Math.min(100,So/c*100):0,Ro=w||L===0?to:L<.5?ao:fo;return e.createElement("div",{ref:I,className:"video-player","data-playing":x?"true":void 0,"data-idle":vo&&!yo?"true":void 0,"data-fullscreen":M?"true":void 0,style:uo?{"--video-aspect":uo}:void 0,onMouseMove:R,onMouseLeave:()=>x&&A(!0),onKeyDown:wo,tabIndex:0,role:"group","aria-label":p?`${p} video player`:"Video player"},e.createElement("div",{className:"video-stage",onClick:O,onDoubleClick:z},e.createElement("video",{ref:t,src:n,preload:"metadata",playsInline:!0,"aria-label":p,onLoadedMetadata:o=>{let f=o.currentTarget;b(Number.isFinite(f.duration)?f.duration:0),f.videoWidth&&f.videoHeight&&Lo(f.videoWidth/f.videoHeight),F(!0)},onTimeUpdate:o=>k(o.currentTarget.currentTime),onDurationChange:o=>{let f=o.currentTarget.duration;b(Number.isFinite(f)?f:0)},onProgress:o=>{let f=o.currentTarget.buffered;Bo(f.length?f.end(f.length-1):0)},onPlay:()=>{S(!0),m(!1)},onPause:()=>S(!1),onEnded:()=>{S(!1),m(!0)},onVolumeChange:o=>{U(o.currentTarget.volume),W(o.currentTarget.muted)},onRateChange:o=>no(o.currentTarget.playbackRate),onEnterPictureInPicture:()=>so(!0),onLeavePictureInPicture:()=>so(!1)}),x?null:e.createElement("span",{className:"video-center-badge","aria-hidden":"true"},y?e.createElement(oo,{size:22,stroke:1.7}):e.createElement(H,{size:22,stroke:1.7}))),e.createElement("div",{className:"video-controls","aria-label":"Playback controls"},e.createElement("div",{className:"video-scrub"},e.createElement("div",{className:"video-scrub-track","aria-hidden":"true"},e.createElement("span",{className:"video-scrub-buffered",style:{width:`${Ao}%`}}),e.createElement("span",{className:"video-scrub-played",style:{width:`${Mo}%`}})),e.createElement("input",{className:"video-scrub-input",type:"range",min:0,max:Number.isFinite(c)&&c>0?c:0,step:.01,value:Math.min(C,c||0),disabled:!i||!c,onChange:o=>D(Number(o.target.value)),onPointerDown:()=>co(!0),onPointerUp:()=>co(!1),"aria-label":"Seek","aria-valuetext":`${E(C)} of ${E(c)}`})),e.createElement("div",{className:"video-buttons"},e.createElement("button",{type:"button",onClick:()=>P(-B),"aria-label":`Back ${B} seconds`,"data-tooltip":`Back ${B}s`},e.createElement(ro,{size:13,stroke:1.7})),e.createElement("button",{type:"button",className:"video-play",onClick:O,"aria-label":x?"Pause":"Play","data-tooltip":x?"Pause":"Play"},x?e.createElement($,{size:14,stroke:1.7}):e.createElement(H,{size:14,stroke:1.7})),e.createElement("button",{type:"button",onClick:()=>P(B),"aria-label":`Forward ${B} seconds`,"data-tooltip":`Forward ${B}s`},e.createElement(eo,{size:13,stroke:1.7})),e.createElement("span",{className:"video-time"},e.createElement("span",{className:"video-time-current"},E(C)),e.createElement("span",{className:"video-time-sep"},"/"),e.createElement("span",{className:"video-time-total"},E(c))),e.createElement("span",{className:"file-toolbar-spacer"}),e.createElement("span",{className:"video-volume"},e.createElement("button",{type:"button",onClick:mo,"aria-label":w?"Unmute":"Mute","data-tooltip":w?"Unmute":"Mute"},e.createElement(Ro,{size:13,stroke:1.7})),e.createElement("input",{type:"range",min:0,max:1,step:.01,value:w?0:L,onChange:o=>V(Number(o.target.value)),"aria-label":"Volume"})),e.createElement("label",{className:"video-rate"},e.createElement("span",{className:"video-rate-caption"},"Speed"),e.createElement("select",{value:bo,onChange:o=>{let f=Number(o.target.value);t.current&&(t.current.playbackRate=f),no(f)},"aria-label":"Playback speed"},Yo.map(o=>e.createElement("option",{key:o,value:o},o,"\xD7")))),G?e.createElement("button",{type:"button",onClick:ko,"aria-label":"Picture in picture","data-tooltip":"Picture in picture","aria-pressed":Po},e.createElement(J,{size:13,stroke:1.7})):null,e.createElement("button",{type:"button",onClick:z,"aria-label":M?"Exit fullscreen":"Fullscreen","data-tooltip":M?"Exit fullscreen":"Fullscreen"},M?e.createElement(_,{size:13,stroke:1.7}):e.createElement(j,{size:13,stroke:1.7})))))}function Fo({object:n,path:p,saveState:I,onUpdateObject:t,onBack:s,canGoBack:i,workspaceActions:F,assets:x,onReplaceFile:S,onReparentObject:y}){let m=n.assetId?x?.[n.assetId]:null,c=v(null);return e.createElement("article",{className:"object-surface file-object","data-object-type":"video"},e.createElement(io,{object:n,path:p,saveState:I,onChange:t,onBack:s,canGoBack:i,workspaceActions:F,onReparentObject:y}),e.createElement("main",{className:"file-workspace"},e.createElement("input",{ref:c,className:"native-file-input",type:"file",accept:"video/*",tabIndex:-1,"aria-hidden":"true",onChange:b=>{let C=b.target.files?.[0];b.target.value="",C&&S?.(C)}}),e.createElement("div",{className:"file-toolbar"},e.createElement("span",{className:"file-ownership"},e.createElement(K,{size:13})," On this device"),e.createElement("span",{className:"file-meta"},m?.fileName||"Video"),e.createElement("span",{className:"file-toolbar-spacer"}),e.createElement("button",{type:"button",onClick:()=>c.current?.click()},e.createElement(Z,{size:13})," Replace"),m?.dataUrl?e.createElement("a",{href:m.dataUrl,download:m.fileName||n.title},e.createElement(X,{size:13})," Download"):null),e.createElement("div",{className:"file-stage"},m?.dataUrl?e.createElement(ho,{src:m.dataUrl,title:n.title}):e.createElement("div",{className:"file-empty-state"},e.createElement("h2",null,"Local content unavailable"),e.createElement("p",null,"Choose the video again to reconnect it."),e.createElement("button",{type:"button",onClick:()=>c.current?.click()},e.createElement(Q,{size:14})," Choose video")))))}var oe=d;function mt(){return Co(oe,Fo,Y)}export{mt as activate};
