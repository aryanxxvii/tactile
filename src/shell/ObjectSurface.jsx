import { ObjectRenderer } from "../objects/registry/ObjectRenderer.jsx";

export function ObjectSurface({ object, ...props }) {
  return <ObjectRenderer object={object} {...props} />;
}
