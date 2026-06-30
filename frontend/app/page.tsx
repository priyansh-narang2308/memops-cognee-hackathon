/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  Activity,
  Mic,
  Database,
  Shield,
  Layers,
  BookOpen,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
      <path
        d="M9 22V10L16 17L23 10V22"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="17" r="2" fill="#faf9f5" />
      <defs>
        <linearGradient
          id="logo-grad"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#cc785c" />
          <stop offset="1" stopColor="#b86549" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const easeOut = [0.25, 0.1, 0.25, 1] as const;

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55, ease: easeOut },
};

export default function LandingPage() {
  // Nav: slides down from top with blur, fast spring
  const navVariants: Variants = {
    hidden: { opacity: 0, y: -18, filter: "blur(6px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { type: "spring", damping: 22, stiffness: 150, delay: 0.1 },
    },
  };

  // Title: word-by-word cascade — each word rises from below with blur
  const titleWords = ["AI", "That", "Never", "Forgets", "an", "Incident"];
  const titleContainerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.09, delayChildren: 0.4 },
    },
  };
  const titleWordVariants: Variants = {
    hidden: { opacity: 0, y: 32, filter: "blur(10px)", rotateX: 8 },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      rotateX: 0,
      transition: { type: "spring", damping: 26, stiffness: 95, mass: 1.1 },
    },
  };

  // Stats row: fades in from bottom, delayed after title
  const statsVariants: Variants = {
    hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { type: "spring", damping: 24, stiffness: 110, delay: 1.05 },
    },
  };

  // Right column: body text then CTA, staggered
  const rightContainerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.14, delayChildren: 0.75 },
    },
  };
  const rightItemVariants: Variants = {
    hidden: { opacity: 0, x: 20, filter: "blur(5px)" },
    show: {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: { type: "spring", damping: 20, stiffness: 100, mass: 0.9 },
    },
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-white font-sans antialiased selection:bg-white/30 selection:text-white">
      {/* Background Image for Hero */}
      <div className="absolute inset-0 z-0 h-screen w-full">
        <img
          src="https://assets.watermelon.sh/hero-35-bg.avif"
          alt="Magical landscape"
          className="h-full w-full object-cover"
        />
        {/* Gradient for text legibility, fading into black at the bottom to match the rest of the page */}
        <div className="absolute inset-0 bg-linear-to-b from-black/50 via-black/60 to-black" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1800px] flex-col justify-between px-6 py-6 md:px-12">
        {/* Navigation — drops from top */}
        <motion.nav
          variants={navVariants}
          initial="hidden"
          animate="show"
          className="flex items-center justify-between"
        >
          <div className="group flex cursor-pointer items-center gap-2 text-white">
            <LogoIcon className="size-8" />
            <span className="text-lg font-medium tracking-wide">MemOps</span>
          </div>

          <div className="hidden items-center gap-10 text-[13px] font-medium tracking-wider text-white/80 md:flex">
            {["FEATURES", "ARCHITECTURE"].map((link) => (
              <a
                key={link}
                href="#features"
                className="flex min-h-[40px] items-center transition-colors hover:text-white"
              >
                {link}
              </a>
            ))}
          </div>

          <Link
            href="/dashboard"
            className="group flex min-h-[40px] items-center gap-2 rounded-full bg-[#cc785c] px-6 py-2.5 text-[14px] font-medium text-white shadow-[inset_0_-2px_0px_rgba(0,0,0,0.2),inset_0_2px_0px_rgba(255,255,255,0.2)] transition-all will-change-transform hover:bg-[#a9583e] active:scale-[0.96]"
          >
            Launch Console
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.nav>

        {/* Bottom Content Area */}
        <div className="flex flex-col items-end justify-between gap-12 pb-8 lg:flex-row">
          {/* Left Column */}
          <div
            className="flex w-full flex-col gap-12 lg:w-1/2"
            style={{ perspective: "800px" }}
          >
            {/* Title: word-by-word cascade */}
            <motion.h1
              variants={titleContainerVariants}
              initial="hidden"
              animate="show"
              className="text-[3.5rem] leading-[1.05] font-normal tracking-tight text-white sm:text-[5rem]"
            >
              {titleWords.map((word, i) => (
                <motion.span
                  key={i}
                  variants={titleWordVariants}
                  className="mr-[0.22em] inline-block last:mr-0"
                >
                  {word}
                </motion.span>
              ))}
            </motion.h1>

            {/* Stats — fades in after title settles */}
            <motion.div
              variants={statsVariants}
              initial="hidden"
              animate="show"
              className="flex gap-12 sm:gap-16"
            >
              {[
                { value: "0ms Amnesia", label: "Continuous Graph Learning" },
                { value: "3D Simulation", label: "Outage Blast Radius" },
              ].map(({ value, label }) => (
                <div key={label} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-white">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="opacity-80"
                    >
                      <circle cx="4" cy="4" r="1.5" />
                      <circle cx="12" cy="4" r="1.5" />
                      <circle cx="4" cy="12" r="1.5" />
                      <circle cx="12" cy="12" r="1.5" />
                    </svg>
                    <span className="text-[1.25rem] font-medium tracking-wide tabular-nums">
                      {value}
                    </span>
                  </div>
                  <span className="ml-6 text-[14px] font-medium tracking-wide text-white/60">
                    {label}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right Column — slides in from right, staggered */}
          <motion.div
            variants={rightContainerVariants}
            initial="hidden"
            animate="show"
            className="flex w-full flex-col items-start gap-8 lg:w-[450px] lg:items-start"
          >
            <motion.p
              variants={rightItemVariants}
              className="text-[1.125rem] leading-[1.6] font-normal text-pretty text-white/90"
            >
              Stop losing the same infrastructure wars. MemOps ingests raw
              incident alerts, Slack thread retros, and post-mortems into a
              permanent, evolving 3D knowledge graph powered by Cognee Cloud.
            </motion.p>

            <Link
              href="/dashboard"
              className="group flex min-h-[40px] items-center gap-2 rounded-full bg-zinc-200 px-7 py-3.5 text-[15px] font-medium text-black shadow-[inset_0_-2px_0px_rgba(0,0,0,0.2),inset_0_2px_0px_rgba(255,255,255,0.2)] transition-all will-change-transform hover:bg-white/90 active:scale-[0.96]"
            >
              Enter Workspace
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>
      </div>

      <div className="bg-black text-white relative z-20">
        <main>
          {/* Features Section */}
          <motion.section
            {...fadeUp}
            id="features"
            className="max-w-[1200px] mx-auto px-6 py-24"
          >
            <div className="text-center space-y-3 mb-16">
              <p
                className="text-xs text-zinc-500 tracking-[1.5px] uppercase"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  letterSpacing: "1.5px",
                }}
              >
                Cognitive Capabilities
              </p>
              <h2
                className="text-white leading-[1.1] tracking-[-1px]"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 400,
                  fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
                }}
              >
                Beyond standard vector database lookup
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: Activity,
                  title: "3D Blast Radius",
                  desc: "Render service dependency paths inside a WebGL force-directed graph. Track propagating failures and predict the cascading impacts of hardware and database outages.",
                },
                {
                  icon: Mic,
                  title: "Voice Copilot I/O",
                  desc: "Dictate system queries naturally using browser Speech Recognition. Traverse memory indices and receive spoken feedback via text-to-speech engine outputs.",
                },
                {
                  icon: Database,
                  title: "Weight-Tuning Feedback",
                  desc: "Capture engineer adjustments on retrieved results. Relational edge weights adjust inside Cognee to make neural indexing smarter over time.",
                },
              ].map(({ icon: Icon, title, desc }, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: i * 0.12, duration: 0.5, ease: easeOut }}
                  whileHover={{ y: -4 }}
                  className="bg-zinc-900 rounded-xl p-8 space-y-5 transition-colors duration-200 hover:bg-zinc-800 cursor-pointer"
                >
                  <motion.div
                    whileHover={{ rotate: -6, scale: 1.05 }}
                    className="w-9 h-9 rounded-lg bg-black flex items-center justify-center"
                  >
                    <Icon className="w-4.5 h-4.5 text-white" />
                  </motion.div>
                  <div>
                    <h3
                      className="text-lg mb-2 text-white"
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontWeight: 500,
                        lineHeight: "1.4",
                      }}
                    >
                      {title}
                    </h3>
                    <p
                      className="text-sm text-zinc-400 leading-relaxed"
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontWeight: 400,
                        lineHeight: "1.55",
                      }}
                    >
                      {desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Architecture Pipeline */}
          <motion.section
            {...fadeUp}
            id="architecture"
            className="max-w-[1200px] mx-auto px-6 py-24"
          >
            <div className="text-center space-y-3 mb-16">
              <p
                className="text-xs text-zinc-500 tracking-[1.5px] uppercase"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  letterSpacing: "1.5px",
                }}
              >
                Integration Schema
              </p>
              <h2
                className="text-white leading-[1.1] tracking-[-1px]"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 400,
                  fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
                }}
              >
                Unified memory workflow control plane
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
              {[
                {
                  step: "01",
                  title: "Ingest",
                  desc: "Alarms stream into remember() to enrich vectors and graphs concurrently.",
                  icon: Layers,
                },
                {
                  step: "02",
                  title: "Recall",
                  desc: "Traverse multi-hop relationships with session memory contexts.",
                  icon: BookOpen,
                },
                {
                  step: "03",
                  title: "Mitigate",
                  desc: "Trigger script commands to automate the recovery cycle.",
                  icon: Terminal,
                },
                {
                  step: "04",
                  title: "Improve",
                  desc: "Apply user feedback ratings to align memory retrieval vectors.",
                  icon: Activity,
                },
              ].map(({ step, title, desc, icon: Icon }, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: i * 0.1, duration: 0.45, ease: easeOut }}
                  className="text-center space-y-3"
                >
                  <motion.div
                    whileHover={{
                      scale: 1.08,
                      backgroundColor: "rgba(204,120,92,0.15)",
                    }}
                    className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center mx-auto transition-colors duration-200"
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </motion.div>
                  <p className="text-xs text-zinc-500 font-mono tracking-wider">
                    {step}
                  </p>
                  <h4
                    className="text-base text-white"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontWeight: 500,
                      lineHeight: "1.4",
                    }}
                  >
                    {title}
                  </h4>
                  <p
                    className="text-sm text-zinc-400 leading-relaxed max-w-xs mx-auto"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontWeight: 400,
                      lineHeight: "1.55",
                    }}
                  >
                    {desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Ontology Section — Dark Product Mockup Card */}
          <motion.section
            {...fadeUp}
            className="max-w-[1200px] mx-auto px-6 py-24"
          >
            <div className="bg-[#181715] rounded-xl p-8 md:p-12 grid grid-cols-1 md:grid-cols-2 gap-12 items-center border border-[#252320]">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 bg-[#252320] rounded-full px-3.5 py-1.5">
                  <Layers className="w-3.5 h-3.5 text-zinc-500" />
                  <span
                    className="text-xs text-zinc-500 tracking-[1.5px] uppercase"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontWeight: 500,
                      fontSize: "11px",
                      letterSpacing: "1.5px",
                    }}
                  >
                    RDF Triple-Store Layering
                  </span>
                </div>
                <h2
                  className="text-[#faf9f5] leading-[1.15] tracking-[-0.5px]"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 400,
                    fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                  }}
                >
                  Ontology-Grounded Incident Knowledge Graph
                </h2>
                <p
                  className="text-sm text-zinc-500 leading-relaxed"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontWeight: 400,
                    lineHeight: "1.55",
                  }}
                >
                  MemOps does not store raw unstructured text chunks. Every
                  post-mortem, runbook step, and telemetry alarm is parsed
                  against a custom subset of the ITIL/ITSM schema taxonomy.
                </p>
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="space-y-3 font-mono text-xs text-zinc-500 bg-[#252320] rounded-xl p-4 border border-[#1f1e1b]"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-[#5db8a6]" />
                    <span>
                      Service{" "}
                      <span className="text-zinc-500">→ DEPENDS_ON →</span>{" "}
                      Service
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-[#5db8a6]" />
                    <span>
                      Incident{" "}
                      <span className="text-zinc-500">→ CAUSED_BY →</span>{" "}
                      FailureMode
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-[#5db8a6]" />
                    <span>
                      FailureMode{" "}
                      <span className="text-zinc-500">→ RESOLVES_VIA →</span>{" "}
                      Runbook
                    </span>
                  </div>
                </motion.div>
              </div>

              {/* Code window card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.5, ease: easeOut }}
                className="bg-[#1f1e1b] rounded-xl p-5 space-y-4 font-mono text-xs border border-[#252320]"
              >
                <div className="flex items-center gap-2 border-b border-[#252320] pb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#c64545]/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#e8a55a]/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#5db872]/80" />
                  <span className="text-[10px] text-zinc-500 ml-auto font-mono">
                    graph_traversal.py
                  </span>
                </div>
                <div className="space-y-2 text-zinc-500 leading-loose">
                  <p>
                    <span className="text-[#5db8a6]">MATCH</span>{" "}
                    (i:Incident)-[:CAUSED_BY]{">"}(f:FailureMode)
                  </p>
                  <p>
                    <span className="text-[#5db8a6]">WHERE</span> i.severity ={" "}
                    <span className="text-[#5db872]">&quot;critical&quot;</span>
                  </p>
                  <p>
                    <span className="text-[#5db8a6]">OPTIONAL MATCH</span>{" "}
                    (f)-[:RESOLVES_VIA]{">"}(r:Runbook)
                  </p>
                  <p>
                    <span className="text-[#5db8a6]">RETURN</span> i.id, r.steps{" "}
                    <span className="text-[#5db8a6]">LIMIT</span> 10
                  </p>
                  <div className="pt-2 border-t border-[#252320]">
                    <p className="text-[#5db872] flex items-center gap-2">
                      <span className="text-zinc-500">→</span> 7 incidents · 3
                      runbooks found
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.section>

          {/* Coral CTA Band */}
          <motion.section
            {...fadeUp}
            className="max-w-[1200px] mx-auto px-6 py-12"
          >
            <motion.div
              whileHover={{ scale: 1.005 }}
              transition={{ duration: 0.3 }}
              className="bg-[#cc785c] rounded-xl p-12 md:p-16 text-center space-y-6"
            >
              <h2
                className="text-[#ffffff] leading-[1.2] tracking-[-0.3px]"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 400,
                  fontSize: "clamp(1.5rem, 2.5vw, 1.75rem)",
                }}
              >
                Ready to give your SRE team institutional memory?
              </h2>
              <p
                className="text-sm text-[#ffffff]/80 max-w-lg mx-auto leading-relaxed"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontWeight: 400,
                  lineHeight: "1.55",
                }}
              >
                Connect your incident management tools and let MemOps build the
                living knowledge graph of your infrastructure.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  asChild
                  className="bg-[#ffffff] text-[#cc785c] hover:bg-[#f5f0e8] shadow-sm"
                  style={{
                    height: "40px",
                    padding: "0 20px",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  <Link href="/dashboard">
                    Launch Console <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
                <a href="#">
                  <Button
                    variant="outline"
                    className="bg-transparent text-[#ffffff] border-[#ffffff]/30 hover:bg-[#ffffff]/10"
                    style={{
                      height: "40px",
                      padding: "0 20px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: 500,
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    View on GitHub
                  </Button>
                </a>
              </div>
            </motion.div>
          </motion.section>
        </main>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="bg-[#181715] border-t border-[#252320]"
        >
          <div className="max-w-[1200px] mx-auto px-6 py-16">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="col-span-2 md:col-span-1 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-6 h-6 rounded bg-[#cc785c]">
                    <span className="text-[#ffffff] text-[10px] font-bold font-mono">
                      M
                    </span>
                  </div>
                  <span
                    className="text-sm text-[#faf9f5]"
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontWeight: 500,
                    }}
                  >
                    MemOps
                  </span>
                </div>
                <p
                  className="text-xs text-zinc-500 leading-relaxed max-w-[200px]"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontWeight: 400,
                    lineHeight: "1.55",
                  }}
                >
                  Cognitive SRE knowledge management built on Cognee.
                </p>
              </div>
              {[
                {
                  title: "Product",
                  links: ["Features", "Architecture", "Pricing", "Changelog"],
                },
                {
                  title: "Resources",
                  links: [
                    "Documentation",
                    "API Reference",
                    "GitHub",
                    "Examples",
                  ],
                },
                {
                  title: "Company",
                  links: ["About", "Blog", "Contact", "Privacy"],
                },
              ].map(({ title, links }) => (
                <div key={title} className="space-y-3">
                  <p
                    className="text-xs text-zinc-500 tracking-wider uppercase"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontWeight: 500,
                      letterSpacing: "1.5px",
                    }}
                  >
                    {title}
                  </p>
                  <ul className="space-y-2">
                    {links.map((link) => (
                      <li key={link}>
                        <a
                          href="#"
                          className="text-sm text-zinc-500 hover:text-white transition-colors"
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontWeight: 400,
                          }}
                        >
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-12 pt-8 border-t border-[#252320] flex flex-col sm:flex-row items-center justify-between gap-4">
              <p
                className="text-xs text-zinc-500"
                style={{ fontFamily: "var(--font-sans)", fontWeight: 400 }}
              >
                © 2026 MemOps. Built for the WeMakeDevs × Cognee Hackathon.
              </p>
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <a href="#" className="hover:text-white transition-colors">
                  Terms
                </a>
                <a href="#" className="hover:text-white transition-colors">
                  Privacy
                </a>
                <a href="#" className="hover:text-white transition-colors">
                  License
                </a>
              </div>
            </div>
          </div>
        </motion.footer>
      </div>
    </div>
  );
}
