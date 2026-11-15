"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

const remarkPlugins = [remarkMath];
const rehypePlugins = [rehypeKatex];

/** Inline Markdown (bold, $math$) for quiz questions, options and explanations. */
export function Inline({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={{ p: ({ children }) => <>{children}</> }}>
      {text}
    </ReactMarkdown>
  );
}
