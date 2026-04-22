'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Minus, Bot } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const QUICK_ACTIONS = [
  { label: 'What can I access now?', question: 'What can I access now with my current proof status?' },
  { label: 'Is my data safe?', question: 'Is my personal data safe with ZKGate?' },
  { label: 'How do ZK proofs work?', question: 'How do zero-knowledge proofs work in simple terms?' },
];

export function AIExplainer() {
  const { address, isConnected } = useAccount();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Auto-greet when opened and connected
  useEffect(() => {
    if (open && messages.length === 0 && isConnected) {
      fetchExplanation({ proofStatus: 'not verified', credentialType: null, question: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchExplanation = async ({
    question,
    proofStatus = 'unknown',
    credentialType = null,
  }: { question?: string; proofStatus?: string; credentialType?: string | null }) => {
    if (loading) return;
    setLoading(true);

    if (question) {
      setMessages((prev) => [...prev, { role: 'user', text: question }]);
    }

    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address ?? null,
          proofStatus,
          credentialType,
          question,
        }),
      });
      const data = await res.json();
      const text = data.explanation ?? data.error ?? 'Sorry, I could not generate a response.';
      setMessages((prev) => [...prev, { role: 'assistant', text }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Connection error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    fetchExplanation({ question: q });
  };

  return (
    <>
      {/* Floating bubble */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="bubble"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => { setOpen(true); setMinimized(false); }}
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 9999,
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #00f0ff, #5b4fff)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 24px rgba(0,240,255,0.4), 0 4px 16px rgba(0,0,0,0.4)',
              color: 'white',
            }}
          >
            <MessageCircle size={22} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="window"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 9999,
              width: 340,
              borderRadius: 20,
              background: 'rgba(8, 8, 20, 0.97)',
              border: '1px solid rgba(0,240,255,0.2)',
              boxShadow: '0 0 40px rgba(0,240,255,0.08), 0 8px 32px rgba(0,0,0,0.6)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: minimized ? 60 : 480,
              transition: 'max-height 0.3s ease',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '14px 16px',
              borderBottom: minimized ? 'none' : '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(0,240,255,0.04)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #00f0ff, #5b4fff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot size={14} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'white', fontFamily: "'Space Grotesk', sans-serif" }}>
                    ZKGate AI Assistant
                  </div>
                  <div style={{ fontSize: 10, color: '#00f0ff', fontFamily: "'JetBrains Mono', monospace" }}>
                    Powered by Groq
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setMinimized((v) => !v)} style={{ ...iconBtn }}>
                  <Minus size={13} />
                </button>
                <button onClick={() => { setOpen(false); setMessages([]); }} style={{ ...iconBtn }}>
                  <X size={13} />
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                {/* Messages */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '0.875rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.625rem',
                }}>
                  {messages.length === 0 && !loading && (
                    <div style={{
                      textAlign: 'center', padding: '1rem',
                      fontSize: 12, color: '#475569', lineHeight: 1.6,
                    }}>
                      {isConnected
                        ? 'Ask me anything about ZKGate, your proofs, or what you can access.'
                        : 'Connect your wallet to get personalized compliance guidance.'}
                    </div>
                  )}

                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div style={{
                        maxWidth: '85%',
                        padding: '8px 12px',
                        borderRadius: msg.role === 'user'
                          ? '12px 12px 4px 12px'
                          : '12px 12px 12px 4px',
                        background: msg.role === 'user'
                          ? 'linear-gradient(135deg, #00f0ff22, #5b4fff22)'
                          : 'rgba(255,255,255,0.04)',
                        border: msg.role === 'user'
                          ? '1px solid rgba(0,240,255,0.2)'
                          : '1px solid rgba(255,255,255,0.06)',
                        fontSize: 12,
                        lineHeight: 1.6,
                        color: msg.role === 'user' ? '#00f0ff' : '#94a3b8',
                        fontFamily: "'Inter', sans-serif",
                      }}>
                        {msg.text}
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{
                        padding: '8px 14px',
                        borderRadius: '12px 12px 12px 4px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex', gap: 4, alignItems: 'center',
                      }}>
                        {[0, 1, 2].map((i) => (
                          <div key={i} style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: '#00f0ff',
                            animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                          }} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Quick actions */}
                {messages.length === 0 && !loading && (
                  <div style={{ padding: '0 0.875rem 0.5rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {QUICK_ACTIONS.map((a) => (
                      <button
                        key={a.label}
                        onClick={() => fetchExplanation({ question: a.question })}
                        style={{
                          padding: '7px 10px', borderRadius: 8, textAlign: 'left',
                          border: '1px solid rgba(0,240,255,0.12)',
                          background: 'rgba(0,240,255,0.04)',
                          color: '#64748b', fontSize: 11, cursor: 'pointer',
                          fontFamily: "'Inter', sans-serif",
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,240,255,0.3)'; (e.currentTarget as HTMLElement).style.color = '#00f0ff'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,240,255,0.12)'; (e.currentTarget as HTMLElement).style.color = '#64748b'; }}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <div style={{
                  padding: '0.75rem',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', gap: 6, flexShrink: 0,
                }}>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                    placeholder="Ask anything..."
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'white', fontSize: 12,
                      outline: 'none', fontFamily: "'Inter', sans-serif",
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    style={{
                      padding: '8px 12px', borderRadius: 8,
                      border: 'none',
                      background: input.trim() && !loading
                        ? 'linear-gradient(135deg, #00f0ff, #5b4fff)'
                        : 'rgba(255,255,255,0.06)',
                      color: input.trim() && !loading ? 'white' : '#64748b',
                      fontSize: 12, cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                      fontWeight: 700,
                    }}
                  >
                    Send
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes typing-dot {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
    </>
  );
}

const iconBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: '#64748b', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
