"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { REPO_URL } from "@/lib/site";
import { BrandMark, Github, Menu, X, Arrow } from "./icons";


const LINKS = [
  { href: "/#problem", label: "Problem" },
  { href: "/#how", label: "How it works" },
  { href: "/#claims", label: "Claims" },
  { href: "/#compare", label: "Compare" },
  { href: "/#architecture", label: "Architecture" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [path]);

  return (
    <div className="nav-wrap" data-scrolled={scrolled || open}>
      <div className="container">
        <nav className="nav" aria-label="Main">
          <NextLink href="/" className="brand" aria-label="ZKGate India — home">
            <BrandMark className="brand-mark" />
            ZKGate <small>India</small>
          </NextLink>
          <div className="nav-links">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href}>{l.label}</a>
            ))}
          </div>
          <div className="nav-actions">
            <a className="icon-btn btn-sm-hide" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Source on GitHub">
              <Github />
            </a>
            <ThemeToggle />
            {path !== "/prove" && (
              <NextLink href="/prove" className="btn btn-primary btn-sm btn-sm-hide">
                Try the demo <Arrow className="arrow" />
              </NextLink>
            )}
            <button className="icon-btn menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </nav>
        <div className="mobile-menu" data-open={open}>
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
          ))}
          <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
          <NextLink href="/prove" className="btn btn-primary" style={{ marginTop: 6 }}>
            Try the demo <Arrow className="arrow" />
          </NextLink>
        </div>
      </div>
    </div>
  );
}
