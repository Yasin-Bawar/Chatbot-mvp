"use client";

import { Lightbulb, TriangleAlert, CircleCheck, Info } from "lucide-react";
import { Lexer } from "marked";
import { createContext, memo, useContext, useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { normalizeDisplayMath, repairMarkdown } from "@/lib/markdown-repair";
import { textDirection } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { Board } from "@/components/board/Board";
import { CodeBlock } from "./CodeBlock";
import { hastText } from "./hast";
import { QuizCard } from "@/components/quiz/QuizCard";
import { VisualCard } from "@/components/visuals/VisualCard";

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins: Options["rehypePlugins"] = [rehypeKatex, [rehypeHighlight, { detect: false }]];

/** Whether the block being rendered is still streaming (for the quiz skeleton). */
const StreamingContext = createContext(false);

function Callout({ text, children }: { text: string; children: ReactNode }) {
  const trimmed = text.trim();
  const kind = trimmed.startsWith("⚠") ? "warn" : trimmed.startsWith("✅") ? "ok" : trimmed.startsWith("💡") ? "tip" : "info";
  const styles = {
    tip: { box: "border-[#dedbff] bg-gradient-to-l from-[#f5f3ff] to-[#fbfaff]", icon: "bg-gradient-brand text-white", Icon: Lightbulb },
    info: { box: "border-[#dbeafe] bg-[#f5f9ff]", icon: "bg-[#3b82f6] text-white", Icon: Info },
    warn: { box: "border-[#fde7c3] bg-[#fffaf0]", icon: "bg-[#f59e0b] text-white", Icon: TriangleAlert },
    ok: { box: "border-[#c9f0d6] bg-[#f3fcf6]", icon: "bg-[#16a34a] text-white", Icon: CircleCheck },
  }[kind];
  const Icon = styles.Icon;
  return (
    <div className={cn("flex gap-2.5 rounded-2xl border px-3.5 py-2.5", styles.box)}>
      <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg shadow-sm", styles.icon)}>
        <Icon className="size-3.5" />
      </span>
      <div className="callout-body min-w-0 flex-1 [&>p+p]:mt-2">{children}</div>
    </div>
  );
}

const components: Components = {
  // Each paragraph/heading/list item follows its own script (English lessons read LTR).
  p: ({ node, children }) => <p dir={textDirection(hastText(node))}>{children}</p>,
  li: ({ node, children }) => <li dir={textDirection(hastText(node))}>{children}</li>,
  h1: ({ node, children }) => <h1 dir={textDirection(hastText(node))}>{children}</h1>,
  h2: ({ node, children }) => <h2 dir={textDirection(hastText(node))}>{children}</h2>,
  h3: ({ node, children }) => <h3 dir={textDirection(hastText(node))}>{children}</h3>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  ),
  blockquote: ({ node, children }) => <Callout text={hastText(node)}>{children}</Callout>,
  pre: function Pre({ node }) {
    const streaming = useContext(StreamingContext);
    const code = (node?.children?.[0] ?? null) as { properties?: { className?: unknown } } | null;
    const classes = Array.isArray(code?.properties?.className) ? (code.properties.className as string[]) : [];
    const language = classes.find((c) => c.startsWith("language-"))?.slice(9) ?? "";
    const text = hastText(code).replace(/\n$/, "");
    if (language === "quiz") return <QuizCard raw={text} streaming={streaming} />;
    if (language === "board") return <Board raw={text} streaming={streaming} />;
    if (language === "globe" || language === "molecule" || language === "sim" || language === "anatomy") {
      return <VisualCard lang={language} raw={text} streaming={streaming} />;
    }
    return (
      <CodeBlock language={language} code={text}>
        {renderHighlighted(code)}
      </CodeBlock>
    );
  },
};

/** Renders rehype-highlight's hast spans (keeps syntax colors inside our CodeBlock). */
function renderHighlighted(node: unknown): ReactNode {
  if (!node || typeof node !== "object") return null;
  const n = node as { type?: string; value?: string; children?: unknown[]; properties?: { className?: string[] } };
  if (n.type === "text") return n.value;
  const children = (n.children ?? []).map((child, i) => <HighlightNode key={i} node={child} />);
  return <>{children}</>;
}

function HighlightNode({ node }: { node: unknown }) {
  const n = node as { type?: string; value?: string; children?: unknown[]; properties?: { className?: string[] } };
  if (n.type === "text") return <>{n.value}</>;
  return <span className={n.properties?.className?.join(" ")}>{renderHighlighted(n)}</span>;
}

const MdBlock = memo(function MdBlock({ source, streaming, animate }: { source: string; streaming: boolean; animate: boolean }) {
  return (
    <StreamingContext.Provider value={streaming}>
      <div className={cn(animate && "md-block")}>
        <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
          {source}
        </ReactMarkdown>
      </div>
    </StreamingContext.Provider>
  );
});

/** Splits Markdown into top-level blocks (paragraphs, lists, tables, code…). */
function splitBlocks(text: string): string[] {
  try {
    return Lexer.lex(text)
      .filter((t) => t.type !== "space")
      .map((t) => t.raw)
      .filter((raw) => raw.trim().length > 0);
  } catch {
    return [text];
  }
}

/**
 * Renders a (possibly still streaming) answer. Finished blocks are memoized,
 * only the last block re-renders, and each new block fades in.
 */
export function StreamingMarkdown({ text, streaming, animate = true }: { text: string; streaming: boolean; animate?: boolean }) {
  const blocks = useMemo(
    () => splitBlocks(normalizeDisplayMath(streaming ? repairMarkdown(text) : text)),
    [text, streaming],
  );

  return (
    <div className="answer" data-streaming={streaming ? "true" : undefined}>
      {blocks.map((block, i) => (
        <MdBlock
          key={i}
          source={block}
          streaming={streaming && i === blocks.length - 1}
          animate={animate}
        />
      ))}
    </div>
  );
}

/** Static Markdown (page viewer, previews). */
export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("answer", className)}>
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
        {normalizeDisplayMath(text)}
      </ReactMarkdown>
    </div>
  );
}
