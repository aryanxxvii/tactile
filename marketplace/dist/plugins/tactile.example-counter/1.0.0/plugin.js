var e=globalThis.__TACTILE_PLUGIN_HOST__;if(!e)throw new Error("Tactile plugin host is unavailable.");var x=e.React,d=e.React,m=e.React.Children,f=e.React.Component,R=e.React.Fragment,b=e.React.PureComponent,C=e.React.cloneElement,y=e.React.createContext,g=e.React.createElement,v=e.React.createRef,E=e.React.forwardRef,h=e.React.isValidElement,T=e.React.lazy,w=e.React.memo,k=e.React.startTransition,S=e.React.useContext,P=e.createId,I=e.ObjectHeader,N=e.ObjectGlyph,O=e.PaperPortal,L=e.useLocalDraft,_=e.codeLanguageForExtension,D=e.resolveTauriInvoke,j=e.CODE_RUNTIME_TOOLS,z=e.getCodeRuntimeProfile,F=e.setCodeRuntimePath,V=e.setCodeRuntimeSelected,A=e.setCodeRuntimeDiscovery,H=e.subscribeCodeRuntimeProfile,M=e.objectTypeFor,U=e.pluginAssetUrl,a=e.installStyle,G=e.React.useCallback,$=e.React.useDeferredValue,q=e.React.useEffect,B=e.React.useId,J=e.React.useLayoutEffect,K=e.React.useMemo,Q=e.React.useReducer,W=e.React.useRef,X=e.React.useState,Y=e.React.useSyncExternalStore,Z=e.React.useTransition;a(`.counter-workspace {
  width: calc(100% - 24px);
  min-height: 0;
  display: grid;
  place-items: center;
  margin: 10px 12px 11px;
  padding: 24px;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--paper-elevated);
  box-shadow: 0 9px 22px color-mix(in srgb, var(--elevation-shadow) 38%, transparent);
}

.counter-panel {
  width: min(360px, 100%);
  color: var(--default-ink);
  text-align: center;
}

.counter-panel h2 {
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
}

.counter-panel p {
  margin: 0 0 18px;
  font-family: var(--font-body);
  font-size: 14px;
}

.counter-actions {
  display: flex;
  justify-content: center;
  gap: 5px;
}

.counter-actions button {
  height: 28px;
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--muted);
  background: var(--paper-elevated);
  font-size: 8.5px;
  cursor: pointer;
}

.counter-actions button:hover,
.counter-actions button:focus-visible {
  outline: 0;
  color: var(--ink);
  border-color: var(--line-strong);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

@media (max-width: 900px) {
  .counter-workspace {
    width: calc(100% - 16px);
    margin-inline: 8px;
  }
}
`);function ce(s){let{React:n,createId:l}=s;function i({size:t=16}){return n.createElement("span",{"aria-hidden":"true",style:{fontSize:`${t}px`,lineHeight:1}},"#")}function u({object:t,onUpdateObject:r,onOpenSettings:p}){let o=Number(t.count)||0;return n.createElement("article",{className:"object-surface counter-object","data-object-type":t.type},n.createElement("main",{className:"counter-workspace"},n.createElement("div",{className:"counter-panel"},n.createElement("h2",null,t.title||"Counter"),n.createElement("p",null,`Count ${o}`),n.createElement("div",{className:"counter-actions",role:"group","aria-label":"Counter controls"},n.createElement("button",{type:"button",onClick:()=>r({count:o-1})},"Decrease"),n.createElement("button",{type:"button",onClick:()=>r({count:o+1})},"Increase"),n.createElement("button",{type:"button",onClick:p},"Plugins")))))}return{type:"example-counter",label:"Counter",description:"A runtime-installed counter cell object.",icon:i,package:{id:"tactile.example-counter",version:"1.0.0"},renderer:{load:async()=>u},cell:{project:({object:t})=>({displayValue:`Count ${Number(t?.count)||0}`})},create:(t={})=>({...t,id:t.id||l("counter"),type:"example-counter",title:t.title||"Counter",description:t.description||"",parent:t.parent||null,count:Number(t.count)||0}),validate:t=>({valid:t?.type==="example-counter"&&Number.isFinite(Number(t?.count)),errors:[]}),migrate:t=>({...t,type:"example-counter",count:Number(t?.count)||0}),serialize:t=>t,deserialize:t=>t}}export{ce as activate};
