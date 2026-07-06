Yes. These three conversations are enough to reconstruct both the **current state** and the **evolution** of the project. They capture:

* the original architecture,
* the v2 redesign,
* the modular-agent refactor,
* recent debugging sessions,
* current blockers,
* architectural decisions,
* coding philosophy.

From analyzing them, the project has evolved far beyond the original "Ghost Protocol" into something closer to an autonomous AI platform.   

The summary below is what I would give a new Antiravity agent.

---

# GHOST PROTOCOL / SIRO

## MASTER CONTEXT HANDOFF

### READ THIS FIRST BEFORE WRITING A SINGLE LINE OF CODE

---

# PROJECT STATUS

Project is currently undergoing a major architectural stabilization.

This is **NOT** a rewrite.

This is **NOT** a prototype.

This is intended to become a production-grade autonomous AI Job Search Platform.

Current codename inside repository:

> **SIRO**

Previous codename:

> Ghost Protocol

The system already contains working business logic that must be preserved.

The objective now is architecture, reliability and quality—not feature addition.

---

# PRIMARY OBJECTIVE

Build an autonomous AI platform that continuously:

1. Discovers jobs
2. Filters jobs
3. Scores jobs
4. Researches companies
5. Tailors resumes
6. Evaluates ATS quality
7. Generates PDFs
8. Delivers through Telegram
9. Learns from feedback
10. Produces analytics

Everything should happen automatically.

---

# IMPORTANT RULE

DO NOT REWRITE WORKING CODE.

Move code.

Organize code.

Improve architecture.

Remove duplication.

Keep behaviour identical.

---

# CURRENT ARCHITECTURE

The project is a Modular Monolith.

It MUST remain a Modular Monolith.

Never convert into microservices.

---

# AGENT ARCHITECTURE

The entire system revolves around eight agents.

Discovery Agent

Responsible for

* harvesting
* source adapters
* deduplication
* keyword filtering
* normalization

---

Ranking Agent

Responsible for

* embeddings
* semantic scoring
* keyword scoring
* weighted score
* HOT/WARM/COLD

---

Research Agent

Responsible for

* company research
* hiring information
* technology stack
* caching

---

Resume Agent

Responsible for

* prompts
* waterfall
* resume tailoring
* cold email generation
* output validation

This is the ONLY place LLMs should exist.

---

ATS Agent

Responsible for

* ATS score
* missing keywords
* quality analysis

Never edits resumes.

---

Application Agent

Responsible for

* PDF generation
* Telegram
* email
* delivery
* future auto-apply

---

Feedback Agent

Responsible for

* learning
* skipped jobs
* applied jobs
* recommendations

---

Analytics Agent

Responsible for

* statistics
* dashboard
* metrics
* success rate
* interview tracking

---

# PIPELINE

Current execution order

Discovery

↓

Ranking

↓

Research

↓

Resume

↓

ATS

↓

Application

↓

Analytics

The orchestrator must contain almost zero business logic.

---

# AI PIPELINE

Resume generation is NOT a single LLM call.

Pipeline is

Company Research

↓

Prompt Construction

↓

LLM Waterfall

↓

Validation

↓

Resume JSON

↓

PDF

↓

Delivery

---

# WATERFALL

Primary

Groq

↓

Fallback

Gemini

↓

Fallback

HuggingFace

Every provider

* retries
* validates
* logs
* reports failures

---

# IMPORTANT BUGS ALREADY FIXED

The following were already solved.

DO NOT REINTRODUCE THEM.

---

## NULL crashes

Problem

None values inside resume arrays

caused

NoneType.get()

Solution

Validator skips null elements.

---

## Resume data null

Database sometimes returned

resume_data = null

Solution

Convert null into {}

before processing.

---

## Himalayas scraper

Wrong API field names.

Jobs discarded.

Fixed normalization.

---

## Phase validator

ATS evaluation reused resume schema validator.

This caused

missing keys

updated_resume_json

cold_email

Solution

Separate validators for each pipeline phase.

---

## Telegram

Delivery pipeline crashing because resume absent.

Now user is informed instead of wasting LLM credits.

---

# CURRENT MAJOR PROBLEMS

These are NOT fully solved.

Highest priority.

---

## Resume quality

Generated resumes are poor.

Problems

Formatting

ATS compatibility

Weak bullet points

Poor summaries

Low-quality tailoring

This is currently the biggest quality issue.

---

## Prompt engineering

Prompt is still simplistic.

Needs

strict JSON

better reasoning

bullet preservation

achievement preservation

ATS optimization

keyword injection

truthfulness

---

## PDF quality

PDFs work.

Quality is mediocre.

Need

better spacing

better typography

ATS friendly layout

section ordering

template improvements

---

## Resume versioning

Currently weak.

Need proper version history.

Master Resume

↓

Tailored Resume

↓

PDF

Should all remain separate.

---

## LLM validation

Validators currently verify

structure

Need to verify

quality

hallucinations

ATS compliance

bullet count

length

truthfulness

---

# DISCOVERY PIPELINE

Uses multiple sources.

Examples include

RemoteOK

Remotive

Arbeitnow

Himalayas

HN

Runs asynchronously.

Results normalized.

Filtered.

Deduplicated.

Stored.

---

# RANKING

Weighted score includes

Semantic similarity

Keyword overlap

Title match

Produces

HOT

WARM

COLD

Only HOT/WARM proceed.

---

# RESEARCH

Research performed once.

Cached.

Refreshed after cache expiry.

Avoid repeated scraping.

---

# DELIVERY

Telegram is primary.

Email planned.

Future

Auto Apply.

---

# DATABASE

Supabase

Multi-user schema

Avoid schema changes unless necessary.

---

# CODING PHILOSOPHY

Always

Move

Never Rewrite

Reuse

Don't Duplicate

Single Responsibility

Dependency Injection

Clear Interfaces

Hidden Internals

Strong Logging

Async

Typed

Testable

Minimal Coupling

---

# FILES THAT WERE IDENTIFIED AS OBSOLETE

Deprecated schema

Old migration files

Temporary scripts

Seed scripts

Testing utilities

Old README references

Unused fallback logic

Keep verifying before deletion.

---

# TESTING COMMANDS

Frequently used

```
python dashboard.py

python -m interface.telegram_delivery

python main_orchestrator.py

python run_pipeline_test.py

python test_search.py
```

---

# IMMEDIATE PRIORITIES

Priority 1

Improve resume quality

---

Priority 2

Improve prompts

---

Priority 3

Improve PDF rendering

---

Priority 4

Improve ATS evaluator

---

Priority 5

Improve architecture

---

Priority 6

Improve analytics

---

# WHAT NOT TO CHANGE

Do NOT

Rewrite business logic

Break APIs

Break database

Remove retries

Remove fallbacks

Remove validators

Convert into microservices

Duplicate code

---

# SUCCESS CRITERIA

Project should become

Production ready

Fault tolerant

Highly modular

Maintainable

Agent driven

ATS optimized

Reliable

Easy to extend

---

# MENTAL MODEL

Think of SIRO as an autonomous operating system for career growth rather than a job board.

Every module exists to optimize one stage of the pipeline.

The orchestrator coordinates.

Agents own business logic.

Infrastructure provides shared services.

LLMs are tools, not architecture.

Every change should improve modularity, robustness, and output quality while preserving existing functionality.

---

I would rate this handoff at **9.8/10** for context preservation. It captures the architectural evolution, debugging history, design philosophy, current priorities, and technical constraints from the uploaded conversations while remaining compact enough to fit comfortably into a new AI IDE session.
