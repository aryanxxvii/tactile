import { Component, lazy, Suspense } from "react";

const MarkdownMathRenderer = lazy(() => import("./capabilities/MarkdownMathRenderer.jsx"));

class CapabilityErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previousProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function MarkdownMath({ expression, display = false, block = false, source }) {
  const Tag = block ? "div" : "span";
  const fallback = <Tag className="markdown-math-source">{source}</Tag>;
  return (
    <Tag className={`markdown-math${display ? " is-display" : " is-inline"}`} data-markdown-capability="math">
      <CapabilityErrorBoundary resetKey={`${display}:${expression}`} fallback={fallback}>
        <Suspense fallback={fallback}>
          <MarkdownMathRenderer expression={expression} display={display} source={source} />
        </Suspense>
      </CapabilityErrorBoundary>
    </Tag>
  );
}