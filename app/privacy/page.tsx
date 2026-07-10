'use client'

import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { privacyContent } from '../../content/privacy'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#080E1A] text-slate-300">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="text-sky-400 hover:text-sky-300 text-sm mb-8 inline-block">← Back to Cheque up</Link>
        <ReactMarkdown
          components={{
            h1: ({children}) => <h1 className="text-3xl font-bold text-white mb-6">{children}</h1>,
            h2: ({children}) => <h2 className="text-xl font-bold text-white mt-8 mb-3">{children}</h2>,
            h3: ({children}) => <h3 className="text-lg font-bold text-white mt-6 mb-2">{children}</h3>,
            p: ({children}) => <p className="mb-4 leading-relaxed">{children}</p>,
            strong: ({children}) => <strong className="text-sky-300 font-semibold">{children}</strong>,
            ul: ({children}) => <ul className="list-disc list-inside space-y-2 ml-2 mb-4">{children}</ul>,
            li: ({children}) => <li className="ml-2">{children}</li>,
            a: ({href, children}) => <a href={href} className="text-sky-400 hover:text-sky-300 underline">{children}</a>,
          }}
        >
          {privacyContent}
        </ReactMarkdown>
      </div>
    </div>
  )
}