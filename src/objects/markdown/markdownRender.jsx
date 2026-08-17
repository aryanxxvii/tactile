import { IconSquare, IconSquareCheck } from "@tabler/icons-react";

import { MarkdownMath } from "./MarkdownCapabilities.jsx";
import { parseInlineMarkdown, parseMarkdownBlocks } from "./markdownParse.js";

function safeHref(value) {
  const href = String(value || "").trim();
  return /^(https?:|mailto:|#|\/)/i.test(href) ? href : "#";
}

function safeImageSrc(value) {
  const src = String(value || "").trim();
  return /^(https?:|data:image\/|\/|\.\/|\.\.\/)/i.test(src) ? src : "";
}

function renderInlineNodes(nodes, keyPrefix) {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.type === "text") return node.value;
    if (node.type === "code-inline") return <code className="markdown-inline-code" key={key}>{node.value}</code>;
    if (node.type === "image") {
      const src = safeImageSrc(node.src);
      return src ? <img className="markdown-inline-image" src={src} alt={node.alt} key={key} /> : `![${node.alt}](${node.src})`;
    }
    if (node.type === "link") return <a href={safeHref(node.href)} key={key} target="_blank" rel="noreferrer">{node.value}</a>;
    if (node.type === "color") return <span className="markdown-colored-text" style={{ color: node.color }} key={key}>{renderInlineNodes(node.children, `${key}-color`)}</span>;
    if (node.type === "highlight") return <mark className="markdown-highlight" style={node.color ? { backgroundColor: node.color } : undefined} key={key}>{renderInlineNodes(node.children, `${key}-highlight`)}</mark>;
    if (node.type === "underline") return <u key={key}>{renderInlineNodes(node.children, `${key}-underline`)}</u>;
    if (node.type === "strong") return <strong key={key}>{renderInlineNodes(node.children, `${key}-strong`)}</strong>;
    if (node.type === "delete") return <del key={key}>{renderInlineNodes(node.children, `${key}-delete`)}</del>;
    if (node.type === "emphasis") return <em key={key}>{renderInlineNodes(node.children, `${key}-emphasis`)}</em>;
    if (node.type === "math-inline" || node.type === "math-display") return <MarkdownMath expression={node.value} display={node.type === "math-display"} source={node.source} key={key} />;
    return node.value || "";
  });
}

export function renderInlineMarkdown(text, keyPrefix = "inline") {
  return renderInlineNodes(parseInlineMarkdown(text), keyPrefix);
}

function renderBlock(block) {
  const key = block.key;
  if (block.type === "math-display") return <MarkdownMath expression={block.value} display block source={block.source} key={key} />;
  if (block.type === "diagram" || block.type === "code") {
    return <pre className="markdown-code-block" data-language={block.language || undefined} data-markdown-diagram={block.type === "diagram" ? "mermaid" : undefined} key={key}><code>{block.value}</code></pre>;
  }
  if (block.type === "heading") {
    const Heading = `h${block.level}`;
    return <Heading key={key}>{renderInlineNodes(block.children, key)}</Heading>;
  }
  if (block.type === "table") {
    return (
      <div className="markdown-table-wrap" key={key}>
        <table className="markdown-table"><thead><tr>{block.headings.map((heading, cellIndex) => <th key={`${key}-h-${cellIndex}`}>{renderInlineNodes(heading, `${key}-h-${cellIndex}`)}</th>)}</tr></thead>
          <tbody>{block.rows.map((row, rowIndex) => <tr key={`${key}-r-${rowIndex}`}>{block.headings.map((_, cellIndex) => <td key={`${key}-r-${rowIndex}-${cellIndex}`}>{renderInlineNodes(row[cellIndex] || [], `${key}-r-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
  if (block.type === "separator") return <hr key={key} />;
  if (block.type === "quote") return <blockquote key={key}>{renderInlineNodes(block.children, key)}</blockquote>;
  if (block.type === "list") {
    const List = block.ordered ? "ol" : "ul";
    const tasks = block.items.some((item) => item.checked !== null);
    return (
      <List className={tasks ? "markdown-task-list" : undefined} key={key}>
        {block.items.map((item, itemIndex) => {
          const itemKey = `${key}-${itemIndex}`;
          const TaskIcon = item.checked ? IconSquareCheck : IconSquare;
          return item.checked === null
            ? <li key={itemKey}>{renderInlineNodes(item.children, itemKey)}</li>
            : <li className={item.checked ? "markdown-task-item is-complete" : "markdown-task-item"} key={itemKey}><TaskIcon size={15} stroke={1.55} aria-hidden="true" /><span>{renderInlineNodes(item.children, itemKey)}</span></li>;
        })}
      </List>
    );
  }
  return <p key={key}>{renderInlineNodes(block.children, key)}</p>;
}

export function renderMarkdownBlocks(contentOrBlocks) {
  const blocks = Array.isArray(contentOrBlocks) ? contentOrBlocks : parseMarkdownBlocks(contentOrBlocks);
  return blocks.map(renderBlock);
}