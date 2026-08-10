import { IconSquare, IconSquareCheck } from "@tabler/icons-react";

function safeHref(value) {
  const href = String(value || "").trim();
  if (/^(https?:|mailto:|#|\/)/i.test(href)) return href;
  return "#";
}

function safeImageSrc(value) {
  const src = String(value || "").trim();
  if (/^(https?:|data:image\/|\/|\.\/|\.\.\/)/i.test(src)) return src;
  return "";
}

export function renderInlineMarkdown(text, keyPrefix = "inline") {
  const source = String(text || "");
  const pattern = /(<span\s+style="color:\s*#[0-9a-fA-F]{6}">.*?<\/span>|<mark\s+style="background-color:\s*#[0-9a-fA-F]{6}">.*?<\/mark>|<u>.*?<\/u>|==[^=]+==|`[^`]+`|!\[[^\]]*\]\([^)]+\)|\*\*[^*]+\*\*|~~[^~]+~~|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
  const nodes = [];
  let cursor = 0;
  let match;
  let index = 0;
  while ((match = pattern.exec(source))) {
    if (match.index > cursor) nodes.push(source.slice(cursor, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index}`;
    if (token.startsWith("<span")) {
      const styled = /^<span\s+style="color:\s*(#[0-9a-fA-F]{6})">(.*?)<\/span>$/.exec(token);
      nodes.push(styled
        ? <span className="markdown-colored-text" style={{ color: styled[1] }} key={key}>{renderInlineMarkdown(styled[2], `${key}-color`)}</span>
        : token);
    } else if (token.startsWith("<mark")) {
      const highlighted = /^<mark\s+style="background-color:\s*(#[0-9a-fA-F]{6})">(.*?)<\/mark>$/.exec(token);
      nodes.push(highlighted
        ? <mark className="markdown-highlight" style={{ backgroundColor: highlighted[1] }} key={key}>{renderInlineMarkdown(highlighted[2], `${key}-highlight`)}</mark>
        : token);
    } else if (token.startsWith("==")) {
      nodes.push(<mark className="markdown-highlight" key={key}>{renderInlineMarkdown(token.slice(2, -2), `${key}-highlight`)}</mark>);
    } else if (token.startsWith("<u>")) {
      nodes.push(<u key={key}>{renderInlineMarkdown(token.slice(3, -4), `${key}-underline`)}</u>);
    } else if (token.startsWith("![")) {
      const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(token);
      const src = safeImageSrc(image?.[2]);
      nodes.push(src ? <img className="markdown-inline-image" src={src} alt={image?.[1] || ""} key={key} /> : token);
    } else if (token.startsWith("`")) {
      nodes.push(<code className="markdown-inline-code" key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("~~")) {
      nodes.push(<del key={key}>{token.slice(2, -2)}</del>);
    } else if (token.startsWith("_")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      nodes.push(
        <a href={safeHref(link?.[2])} key={key} target="_blank" rel="noreferrer">
          {link?.[1] || token}
        </a>,
      );
    }
    cursor = match.index + token.length;
    index += 1;
  }
  if (cursor < source.length) nodes.push(source.slice(cursor));
  return nodes;
}

function taskItem(line, key) {
  const match = /^- \[([ xX])\] (.*)$/.exec(line);
  if (!match) return null;
  const checked = match[1].toLowerCase() === "x";
  const TaskIcon = checked ? IconSquareCheck : IconSquare;
  return (
    <li className={checked ? "markdown-task-item is-complete" : "markdown-task-item"} key={key}>
      <TaskIcon size={15} stroke={1.55} aria-hidden="true" />
      <span>{renderInlineMarkdown(match[2], key)}</span>
    </li>
  );
}

export function renderMarkdownBlocks(content) {
  const lines = String(content || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const key = `block-${index}`;
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(<pre className="markdown-code-block" data-language={language || undefined} key={key}><code>{code.join("\n")}</code></pre>);
      continue;
    }
    if (/^#{1,6} /.test(line)) {
      const level = line.match(/^#+/)[0].length;
      const text = line.slice(level + 1);
      const Heading = `h${level}`;
      blocks.push(<Heading key={key}>{renderInlineMarkdown(text, key)}</Heading>);
      index += 1;
      continue;
    }
    if (line.includes("|") && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      const rows = [];
      const parseRow = (value) => value.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((part) => part.trim());
      const headings = parseRow(line);
      index += 2;
      while (index < lines.length && lines[index].includes("|")) {
        rows.push(parseRow(lines[index]));
        index += 1;
      }
      blocks.push(
        <div className="markdown-table-wrap" key={key}>
          <table className="markdown-table"><thead><tr>{headings.map((heading, cellIndex) => <th key={`${key}-h-${cellIndex}`}>{renderInlineMarkdown(heading, `${key}-h-${cellIndex}`)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={`${key}-r-${rowIndex}`}>{headings.map((_, cellIndex) => <td key={`${key}-r-${rowIndex}-${cellIndex}`}>{renderInlineMarkdown(row[cellIndex] || "", `${key}-r-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push(<hr key={key} />);
      index += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      const quoted = [];
      while (index < lines.length && lines[index].startsWith("> ")) {
        quoted.push(lines[index].slice(2));
        index += 1;
      }
      blocks.push(<blockquote key={key}>{renderInlineMarkdown(quoted.join(" "), key)}</blockquote>);
      continue;
    }
    if (/^- (?:\[[ xX]\] )?/.test(line)) {
      const items = [];
      while (index < lines.length && /^- (?:\[[ xX]\] )?/.test(lines[index])) {
        const task = taskItem(lines[index], `${key}-${index}`);
        items.push(task || <li key={`${key}-${index}`}>{renderInlineMarkdown(lines[index].slice(2), `${key}-${index}`)}</li>);
        index += 1;
      }
      blocks.push(<ul className={items.some((item) => item?.props?.className?.includes("markdown-task-item")) ? "markdown-task-list" : undefined} key={key}>{items}</ul>);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\. /.test(lines[index])) {
        items.push(<li key={`${key}-${index}`}>{renderInlineMarkdown(lines[index].replace(/^\d+\. /, ""), `${key}-${index}`)}</li>);
        index += 1;
      }
      blocks.push(<ol key={key}>{items}</ol>);
      continue;
    }
    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length
      && lines[index].trim()
      && !/^(#{1,6} |```|> |- (?:\[[ xX]\] )?|\d+\. |-{3,}$|\*{3,}$)/.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={key}>{renderInlineMarkdown(paragraph.join(" "), key)}</p>);
  }
  return blocks;
}
