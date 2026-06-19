'use client'
import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import { getDocuments, uploadDocument, askDocument } from '@/lib/api'
import { useDropzone } from 'react-dropzone'
import { FileText, Upload, MessageSquare, Loader } from 'lucide-react'
import toast from 'react-hot-toast'

export default function DocumentsPage() {
  const [docs, setDocs] = useState<any[]>([])
  const [selectedDoc, setSelectedDoc] = useState<any>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => { loadDocs() }, [])

  async function loadDocs() {
    try { setDocs(await getDocuments()) }
    catch { toast.error('Failed to load documents') }
  }

  const onDrop = useCallback(async (files: File[]) => {
    setUploading(true)
    for (const file of files) {
      const toastId = toast.loading(`Processing ${file.name}...`)
      try {
        const doc = await uploadDocument(file)
        toast.success(`✓ ${doc.filename}`, { id: toastId })
      } catch { toast.error(`Failed: ${file.name}`, { id: toastId }) }
    }
    setUploading(false)
    await loadDocs()
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, multiple: true,
    accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'], 'text/plain': ['.txt'], 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
  })

  async function handleAsk() {
    if (!selectedDoc || !question.trim()) return
    setLoading(true)
    setAnswer('')
    try {
      const res = await askDocument(selectedDoc.id, question)
      setAnswer(res.answer)
    } catch { toast.error('Failed to get answer') }
    finally { setLoading(false) }
  }

  const FILE_ICONS: Record<string, string> = { pdf: '📄', docx: '📝', txt: '📃', csv: '📊', xlsx: '📊', pptx: '📑' }

  return (
    <div className="flex h-screen bg-[#0f0f10]">
      <Sidebar />
      <main className="flex-1 flex gap-0 min-w-0 overflow-hidden">
        {/* Document list */}
        <div className="w-80 flex flex-col border-r border-[#2a2a2b]">
          <div className="px-4 py-4 border-b border-[#2a2a2b]">
            <h1 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-400" /> Documents
            </h1>
          </div>

          {/* Upload zone */}
          <div {...getRootProps()} className={`mx-3 mt-3 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${isDragActive ? 'border-brand-500 bg-brand-600/10' : 'border-[#2a2a2b] hover:border-[#3a3a3b]'}`}>
            <input {...getInputProps()} />
            {uploading ? <Loader className="w-5 h-5 text-brand-400 mx-auto animate-spin" /> : <Upload className="w-5 h-5 text-[#8a8a9a] mx-auto mb-1" />}
            <p className="text-xs text-[#8a8a9a] mt-1">{isDragActive ? 'Drop files here' : 'Upload PDF, DOCX, CSV, TXT'}</p>
          </div>

          {/* Doc list */}
          <div className="flex-1 overflow-y-auto py-3 space-y-1 px-2">
            {docs.map(doc => (
              <button
                key={doc.id}
                onClick={() => { setSelectedDoc(doc); setAnswer('') }}
                className={`w-full text-left px-3 py-3 rounded-xl transition-colors ${selectedDoc?.id === doc.id ? 'bg-brand-600/15 border border-brand-500/20' : 'hover:bg-[#1a1a1b]'}`}
              >
                <div className="flex items-center gap-2">
                  <span>{FILE_ICONS[doc.type] || '📄'}</span>
                  <span className="text-sm text-[#c8c8d0] truncate flex-1">{doc.filename}</span>
                </div>
                {doc.summary && <p className="text-xs text-[#8a8a9a] mt-1 line-clamp-2">{doc.summary}</p>}
              </button>
            ))}
            {docs.length === 0 && (
              <p className="text-center text-[#8a8a9a] text-sm py-8">Upload documents to get started</p>
            )}
          </div>
        </div>

        {/* Document viewer / QA */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedDoc ? (
            <>
              <div className="px-6 py-4 border-b border-[#2a2a2b]">
                <h2 className="text-lg font-semibold text-white">{selectedDoc.filename}</h2>
                {selectedDoc.summary && <p className="text-sm text-[#8a8a9a] mt-1">{selectedDoc.summary}</p>}
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {answer && (
                  <div className="bg-[#1a1a1b] border border-[#2a2a2b] rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-brand-400" />
                      <span className="text-sm font-medium text-white">Answer</span>
                    </div>
                    <p className="text-[#c8c8d0] text-sm leading-relaxed whitespace-pre-wrap">{answer}</p>
                  </div>
                )}
                {loading && (
                  <div className="flex items-center gap-2 text-[#8a8a9a] text-sm">
                    <Loader className="w-4 h-4 animate-spin" /> Analyzing document...
                  </div>
                )}
              </div>
              <div className="px-6 pb-4">
                <div className="flex gap-2">
                  <input
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="Ask a question about this document..."
                    className="flex-1 bg-[#1a1a1b] border border-[#2a2a2b] text-[#e8e8ea] text-sm rounded-xl px-4 py-3 outline-none focus:border-brand-500"
                    onKeyDown={e => e.key === 'Enter' && handleAsk()}
                  />
                  <button onClick={handleAsk} disabled={loading || !question.trim()} className="px-4 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-xl text-white text-sm">Ask</button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-12 h-12 text-[#4a4a5a] mx-auto mb-4" />
                <p className="text-[#8a8a9a]">Select a document to analyze and ask questions</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
