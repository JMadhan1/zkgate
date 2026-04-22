'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Menu } from 'lucide-react';

const ShieldIcon = () => (
  <svg width="20" height="22" viewBox="0 0 20 22" fill="none" style={{ display: 'block' }}>
    <path
      d="M10 1L2 4.5V10C2 14.418 5.582 18.5 10 20C14.418 18.5 18 14.418 18 10V4.5L10 1Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M7 10.5L9 12.5L13 8.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const Navbar = () => {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const navLinks = [
    { name: 'Issue', href: '/issue' },
    { name: 'Prove', href: '/prove' },
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'DeFi Demo', href: '/defi-demo' },
    { name: 'Airdrop', href: '/airdrop' },
    { name: 'Docs', href: '/docs' },
  ];

  return (
    <>
      <nav
        className="fixed top-0 w-full z-50 transition-all duration-300"
        style={{
          background: isScrolled
            ? 'rgba(5, 5, 16, 0.85)'
            : 'transparent',
          backdropFilter: isScrolled ? 'blur(20px)' : 'none',
          borderBottom: isScrolled ? '1px solid rgba(255,255,255,0.04)' : 'none',
          padding: isScrolled ? '14px 0' : '24px 0',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group" style={{ textDecoration: 'none' }}>
            <div
              className="animate-pulse-glow"
              style={{
                color: '#00f0ff',
                display: 'flex',
                alignItems: 'center',
                filter: 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.6))',
                transition: 'filter 0.3s ease',
              }}
            >
              <ShieldIcon />
            </div>
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '1.1rem',
                letterSpacing: '-0.02em',
                color: 'white',
              }}
            >
              ZK<span style={{ color: '#00f0ff' }}>Gate</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className="nav-link-wrapper"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '14px',
                    fontWeight: 500,
                    color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
                    textDecoration: 'none',
                    transition: 'color 0.2s ease',
                    paddingBottom: '4px',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
                  }}
                >
                  <span
                    style={{
                      position: 'relative',
                      paddingBottom: '4px',
                      display: 'inline-block',
                    }}
                  >
                    {link.name}
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        height: '2px',
                        width: isActive ? '100%' : '0',
                        background: 'linear-gradient(90deg, #00f0ff, #8b5cf6)',
                        borderRadius: '2px',
                        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                      className={!isActive ? 'nav-underline-hover' : ''}
                    />
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Right: Connect Wallet + Mobile Toggle */}
          <div className="flex items-center gap-3">
            {mounted && (
              <div className="gradient-border-btn hidden md:block" style={{ padding: 0 }}>
                <div className="connect-button-wrapper" style={{ padding: '0' }}>
                  <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
                </div>
              </div>
            )}

            {/* Hamburger */}
            <button
              className="md:hidden relative z-50 p-2"
              onClick={() => setMobileOpen((v) => !v)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Full-Screen Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="mobile-nav-overlay md:hidden"
          >
            {/* Background orb */}
            <div style={{
              position: 'absolute',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0,240,255,0.06), transparent 70%)',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }} />

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
              {navLinks.map((link, i) => {
                const isActive = pathname === link.href;
                return (
                  <motion.div
                    key={link.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07, duration: 0.3 }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`mobile-nav-link ${isActive ? 'active' : ''}`}
                    >
                      {link.name}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            {mounted && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: navLinks.length * 0.07 + 0.1 }}
                className="connect-button-wrapper"
                style={{ marginTop: '2rem' }}
              >
                <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inject hover underline style */}
      <style jsx global>{`
        .nav-link-wrapper:hover .nav-underline-hover {
          width: 100% !important;
        }
      `}</style>
    </>
  );
};
