import React from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import {
  TgButtonsBlock,
  TgCollapseBlock,
  TgGalleryBlock,
  TgVideoBlock,
  isSafeBlogUrl,
  normalizeClientMediaUrl,
  type TgButtonItem,
  type TgCollapsePayload,
  type TgMediaItem
} from './components/BlogRichBlocks';

interface BlogMarkdownRendererProps {
  content: string;
}

function extractTextFromReactNode(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromReactNode).join('');
  if (React.isValidElement(node)) {
    return extractTextFromReactNode((node.props as any)?.children);
  }
  return '';
}

export const BlogMarkdownRenderer: React.FC<BlogMarkdownRendererProps> = ({ content }) => {
  const safeContent = String(content || '');

  return (
    <div className="blog-prose space-y-2 text-[16px] sm:text-[17px] text-sepia/95 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        urlTransform={(url) => (isSafeBlogUrl(url) ? url : '')}
        components={{
          h1: ({ children }) => (
            <h2 className="text-[24px] sm:text-[28px] font-gothic font-bold text-sepia mt-7 mb-3 leading-snug break-words">
              {children}
            </h2>
          ),
          h2: ({ children }) => (
            <h2 className="text-[22px] sm:text-[25px] font-gothic font-bold text-sepia mt-7 mb-3 pb-2 border-b border-sepia/15 leading-snug break-words">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[19px] sm:text-[22px] font-gothic font-bold text-sepia mt-6 mb-2.5 leading-snug break-words">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-[17px] sm:text-[19px] font-gothic font-bold text-sepia mt-5 mb-2 leading-snug break-words">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="my-3.5 text-[16px] sm:text-[17px] text-sepia/95 leading-relaxed break-words">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-sepia">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-sepia/95">{children}</em>
          ),
          hr: () => <hr className="my-6 border-sepia/20" />,
          blockquote: ({ children }) => (
            <blockquote className="my-5 px-4 py-3 rounded-xl border border-sepia/25 bg-transparent backdrop-blur-xs italic text-[16px] sm:text-[17px] text-sepia/90 leading-relaxed">
              {children}
            </blockquote>
          ),
          ul: ({ className, children }) => {
            const isTask = String(className || '').includes('contains-task-list');
            return (
              <ul
                className={`my-4 space-y-2 text-[16px] sm:text-[17px] text-sepia/95 leading-relaxed ${
                  isTask ? 'contains-task-list' : 'pl-5 list-disc'
                }`}
              >
                {children}
              </ul>
            );
          },
          ol: ({ children }) => (
            <ol className="my-4 space-y-2 pl-5 list-decimal text-[16px] sm:text-[17px] text-sepia/95 leading-relaxed">
              {children}
            </ol>
          ),
          li: ({ className, children }) => (
            <li className={`break-words ${className || ''}`}>{children}</li>
          ),
          table: ({ children }) => (
            <div className="my-5 w-full overflow-x-auto rounded-xl border border-sepia/25 bg-transparent">
              <table className="w-full text-left border-collapse text-[14px] sm:text-[15px] tabular-nums">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-sepia/20 bg-gold/10 text-sepia font-bold">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 font-bold text-sepia border-r last:border-r-0 border-sepia/15">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2.5 text-sepia/90 border-t border-r last:border-r-0 border-sepia/15 align-top break-words">
              {children}
            </td>
          ),
          a: ({ href, children }) => {
            const cleanHref = String(href || '').trim();
            if (!isSafeBlogUrl(cleanHref)) {
              return <span className="text-sepia">{children}</span>;
            }
            const isInternal = cleanHref.startsWith('/') && !cleanHref.startsWith('//');
            if (isInternal) {
              return (
                <Link
                  to={cleanHref}
                  className="text-amber-800 hover:text-gold font-semibold underline decoration-gold/60 underline-offset-4 transition-colors break-words"
                >
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={cleanHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-800 hover:text-gold font-semibold underline decoration-gold/60 underline-offset-4 transition-colors break-words"
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => {
            const safeSrc = normalizeClientMediaUrl(src);
            return (
              <figure className="my-5">
                <img
                  src={safeSrc}
                  alt={alt || 'Иллюстрация AIhim'}
                  referrerPolicy="no-referrer"
                  className="w-full max-h-[460px] object-cover rounded-2xl border border-sepia/25 shadow-sm"
                />
                {alt && (
                  <figcaption className="mt-2 text-center text-[14px] italic text-sepia/75">
                    {alt}
                  </figcaption>
                )}
              </figure>
            );
          },
          pre: ({ children }) => {
            const childArr = React.Children.toArray(children);
            const first = childArr[0];
            if (React.isValidElement(first)) {
              const cls = String((first.props as any)?.className || '');
              const rawText = extractTextFromReactNode((first.props as any)?.children).trim();

              if (cls.includes('language-tg-video')) {
                try {
                  const item = JSON.parse(rawText) as TgMediaItem;
                  return <TgVideoBlock item={item} />;
                } catch {
                  // fall back to code block
                }
              }

              if (cls.includes('language-tg-gallery')) {
                try {
                  const items = JSON.parse(rawText) as TgMediaItem[];
                  if (Array.isArray(items)) {
                    return <TgGalleryBlock items={items} />;
                  }
                } catch {
                  // fall back
                }
              }

              if (cls.includes('language-tg-buttons')) {
                try {
                  const rows = JSON.parse(rawText) as TgButtonItem[][];
                  if (Array.isArray(rows)) {
                    return <TgButtonsBlock rows={rows} />;
                  }
                } catch {
                  // fall back
                }
              }

              if (cls.includes('language-tg-collapse')) {
                try {
                  const payload = JSON.parse(rawText) as TgCollapsePayload;
                  return (
                    <TgCollapseBlock
                      payload={payload}
                      renderMarkdown={(nestedMd) => <BlogMarkdownRenderer content={nestedMd} />}
                    />
                  );
                } catch {
                  // fall back
                }
              }
            }

            return (
              <pre className="my-4 p-4 rounded-xl border border-sepia/25 bg-transparent backdrop-blur-sm overflow-x-auto font-mono text-[14px] text-sepia leading-relaxed whitespace-pre-wrap break-words">
                {children}
              </pre>
            );
          },
          code: ({ className, children }) => {
            const isBlock = Boolean(className && className.includes('language-'));
            if (isBlock) {
              return (
                <code className={`${className || ''} font-mono text-[14px] whitespace-pre-wrap break-words`}>
                  {children}
                </code>
              );
            }
            return (
              <code className="px-1.5 py-0.5 rounded border border-sepia/20 bg-transparent font-mono text-[14px] text-amber-900 whitespace-pre-wrap break-words">
                {children}
              </code>
            );
          }
        }}
      >
        {safeContent}
      </ReactMarkdown>
    </div>
  );
};
