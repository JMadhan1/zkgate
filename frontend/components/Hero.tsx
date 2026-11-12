"use client";

import NextLink from "next/link";
import { useEffect, useState } from "react";
import { HeroCanvas } from "./HeroCanvas";
import { Arrow, Check } from "./icons";

const WORDS = ["over 18.", "a resident.", "a citizen.", "KYC-ready."];

function WordCycle() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % WORDS.length), 2400);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span className="word-cycle" aria-live="off">
      {WORDS.map((w, n) => (
        <span
          key={w}
          aria-hidden={n !== i}
          data-state={n === i ? "in" : n === (i + WORDS.length - 1) % WORDS.length ? "out" : "next"}
        >
          {w}
        </span>
      ))}
    </span>
  );
}

export function Hero() {
  const [phase, setPhase] = useState<"data" | "proof">("data");
  return (
    <section className="hero container-wide" aria-labelledby="hero-title">
      <div className="stage">
        <div className="hero-inner">
          <div>
            <span className="chip reveal">
              <span className="flag" aria-hidden><i style={{ background: "#FF9933" }} /><i style={{ background: "#fff" }} /><i style={{ background: "#138808" }} /></span>
              <span><b>Zero-knowledge identity</b> · built for India</span>
            </span>
            <h1 id="hero-title" className="display reveal" style={{ ["--d" as string]: "80ms" }}>
              <span className="line">Prove you&apos;re</span>
              <span className="line"><WordCycle /></span>
              <span className="line serif" style={{ fontSize: "0.92em" }}>Reveal nothing.</span>
            </h1>
            <p className="lede reveal" style={{ ["--d" as string]: "160ms" }}>
              ZKGate turns your Aadhaar offline eKYC into a <b>~800-byte proof</b> that answers one question and
              nothing else. No name, no date of birth, no address, no Aadhaar number. It&apos;s generated{" "}
              <b>on your device</b> and checked with real cryptography.
            </p>
            <div className="cta-row reveal" style={{ ["--d" as string]: "240ms" }}>
              <NextLink href="/prove" className="btn btn-saffron">
                Generate a proof <Arrow className="arrow" />
              </NextLink>
              <a href="#how" className="btn btn-ghost-light">How it works</a>
            </div>
            <div className="trust reveal" style={{ ["--d" as string]: "320ms" }}>
              <span>Groth16 · BN128</span>
              <span>Runs in your browser</span>
              <span>0 personal fields sent</span>
            </div>
          </div>

          <div className="hero-visual reveal" style={{ ["--d" as string]: "200ms" }}>
            <HeroCanvas onPhase={setPhase} />
            <span className="hv-verdict" data-show={phase === "proof"} aria-hidden>
              <Check /> age_above_18: true
            </span>
            <span className="hv-caption" data-phase={phase} aria-hidden>
              <span className="dot" />
              {phase === "data" ? "private eKYC data · on device" : "zero-knowledge proof · 0 fields"}
            </span>
            <span className="sr-only">
              Animation: a citizen&apos;s private details dissolve into a rotating chakra, the proof, which reveals only
              that the claim is true.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
