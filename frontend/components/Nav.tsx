"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { REPO_URL } from "@/lib/site";
import { Arrow, BrandMark, Github, Menu, X } from "./icons";

const LINKS = [
  { href: "/#problem", label: "Why" },
  { href: "/#difference", label: "Difference" },
  { href: "/#how", label: "How it works" },
  { href: "/#claims", label: "Claims" },
  { href: "/#architecture", label: "Open source" },
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
    <header className="nav-wrap" data-scrolled={scrolled || open}>
      <div className="container">
        <nav className="nav" aria-label="Main">
          <NextLink href="/" className="brand" aria-label="ZKGate India, home">
            <BrandMark className="brand-mark" />
            zkgate<sup>IN</sup>
          </NextLink>
          <div className="nav-links">
            {LINKS.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
          </div>
          <div className="nav-actions">
            <a className="icon-btn hide-sm" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Source on GitHub"><Github /></a>
            <ThemeToggle />
            {path !== "/prove" && (
              <NextLink href="/prove" className="btn btn-ink btn-sm hide-sm">Try the demo <Arrow className="arrow" /></NextLink>
            )}
            <button className="icon-btn menu-btn" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </nav>
        <div className="mobile-menu" data-open={open}>
          {LINKS.map((l) => <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>)}
          <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
          <NextLink href="/prove" className="btn btn-ink">Try the demo <Arrow className="arrow" /></NextLink>
        </div>
      </div>
    </header>
  );
}
