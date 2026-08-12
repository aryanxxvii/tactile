import { ObjectRenderer } from "../objects/objectRegistry.jsx";

export function ObjectSurface({ object, ...props }) {
  return <ObjectRenderer object={object} {...props} />;
}
