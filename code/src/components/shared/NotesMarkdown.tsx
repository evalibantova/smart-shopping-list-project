import type { ComponentProps } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'

// Tailwind's preflight resets list-style, so markers must be set explicitly.
const listStyle = { margin: '0 0 8px', paddingLeft: 22 }

const components = {
  p: (props: ComponentProps<'p'>) => <p style={{ margin: '0 0 8px' }} {...props} />,
  ol: (props: ComponentProps<'ol'>) => <ol style={{ ...listStyle, listStyleType: 'decimal' }} {...props} />,
  ul: (props: ComponentProps<'ul'>) => <ul style={{ ...listStyle, listStyleType: 'disc' }} {...props} />,
  li: (props: ComponentProps<'li'>) => <li style={{ marginBottom: 4 }} {...props} />,
  a: (props: ComponentProps<'a'>) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'var(--accent, #1a73e8)', textDecoration: 'underline', wordBreak: 'break-all' }}
    />
  ),
}

// Renders recipe notes as Markdown (GFM, so bare URLs become links) with inline HTML allowed
// but sanitized. Links open in a new tab.
export function NotesMarkdown({ source }: { source: string }) {
  return (
    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
