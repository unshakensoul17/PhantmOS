"""
agents/ — Ghost Protocol Multi-Agent Architecture

Each agent owns a single responsibility and exposes a clean public interface.
The orchestrator coordinates agents without containing business logic.

Agents:
    discovery_agent   — Job harvesting, filtering, deduplication
    ranking_agent     — Embedding, scoring, band classification
    research_agent    — Company context research & caching
    resume_agent      — LLM-based resume tailoring & cold email generation
    ats_agent         — ATS score evaluation & interview prep
    application_agent — PDF generation, delivery (Telegram/Email/WhatsApp)
    feedback_agent    — User feedback recording & weight adjustment
    analytics_agent   — Pipeline stats, daily digest, dashboards
"""
from agents.discovery_agent import DiscoveryAgent
from agents.ranking_agent import RankingAgent
from agents.research_agent import ResearchAgent
from agents.resume_agent import ResumeAgent
from agents.ats_agent import ATSAgent
from agents.application_agent import ApplicationAgent
from agents.feedback_agent import FeedbackAgent
from agents.analytics_agent import AnalyticsAgent

__all__ = [
    "DiscoveryAgent",
    "RankingAgent",
    "ResearchAgent",
    "ResumeAgent",
    "ATSAgent",
    "ApplicationAgent",
    "FeedbackAgent",
    "AnalyticsAgent",
]
