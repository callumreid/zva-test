# Coval Platform - Zoom Virtual Agent (ZVA) Integration Design

## Overview

This document outlines how to add Zoom Virtual Agent (ZVA) web chat as a supported provider in the Coval evaluation platform, enabling both **transcript-based evaluation** (importing existing conversations) and **live simulation** (automated conversations with a ZVA bot).

---

## 1. Architecture Decision: Two Modes of Operation

### Mode A: Transcript Import (Evaluation Only)

Pull existing conversations from the ZVA Reporting API and run Coval metrics on them.

- **Source**: `GET /v2/virtual_agent/report/transcripts` (OAuth bearer token)
- **Use case**: Evaluate how a ZVA bot has been performing on real customer conversations
- **No simulation needed** — just import, normalize, and run metrics
- **Additional data**: Engagement details, query intents, survey results, variables

### Mode B: Live Simulation (Simulation + Evaluation)

Automated personas interact with a live ZVA chat widget via browser automation, producing transcripts that Coval then evaluates.

- **Tool**: Playwright (headless browser)
- **Reason**: The ZVA web SDK (`zcc-sdk.js`) only operates in a browser context. There is no REST API for sending/receiving chat messages. The SDK uses WebSockets internally, but reverse-engineering that protocol would be fragile.
- **Use case**: Run test scenarios against a ZVA bot to evaluate specific behaviors

---

## 2. ZVA Data Model Mapping

### ZVA Transcript → Coval Transcript

ZVA transcript message format:
```json
{
  "sender": "AI Agent" | "Bot" | "Consumer",
  "timestamp": "2024-01-15T10:30:00Z",
  "message_type": "string",
  "text": "Hello, how can I help?",
  "kb_articles": [{"title": "...", "url": "..."}]
}
```

Maps to Coval `CovalTranscriptMessage`:
```python
CovalTranscriptMessage(
  role=CovalRole.AGENT,       # "AI Agent"/"Bot" → AGENT, "Consumer" → PERSONA
  content="Hello, how can I help?",
  start_offset=<seconds from engagement start>,
  end_offset=<seconds from engagement start>,
)
```

### ZVA Engagement → Coval SimulationOutput

| ZVA Field | Coval Field |
|-----------|-------------|
| `engagement_id` | `customer_simulation_id` |
| `start_time` / `end_time` | `created_at` / timing metadata |
| `duration` | `audio_length_seconds` (repurposed for chat duration) |
| `campaign_name` | Stored in `metadata` |
| `outcome` | Stored in `metadata` |
| `interaction_turns` | Derivable from transcript |
| `agent_messages_sent` / `consumer_messages_sent` | Derivable from transcript |
| `implicit_resolution` | Maps to a metric value |
| `articles` / `topics` / `skills` / `tools` | Stored in `metadata` for metric use |

### ZVA Query Details → Coval Tool Calls / Metadata

| ZVA Field | Coval Usage |
|-----------|-------------|
| `intents[].intent_name` | Intent detection metric |
| `intents[].accuracy` | Intent confidence metric |
| `articles[].is_helpful` | KB retrieval quality metric |
| `articles[].article_score` | KB relevance metric |
| `topic_name` | Topic classification metadata |

---

## 3. Backend Integration Points

### 3.1 New Model Type Constant

```python
# model_type_constants.py (or wherever constants live)
MODEL_TYPE_ZVA_CHAT = "MODEL_TYPE_ZVA_CHAT"
```

Note: `MODEL_TYPE_ZOOM` already exists for Zoom meeting integration. ZVA chat is a distinct product requiring its own type.

### 3.2 ZVA Model Manager

**File**: `backend/evaluation_pipeline/models/ZvaChatModelManager.py`

Extends `APISimulatorModelManager`. Responsibilities:
- Extract ZVA-specific config from agent metadata:
  - `zva_api_key` (Campaign API key for the web SDK)
  - `zva_env` (`us01` or `eu01`)
  - `zva_entry_id` (optional, alternative to campaign)
  - `zva_site_url` (URL of the page hosting the ZVA widget)
  - `zoom_oauth_token` (for transcript import mode)
  - `zoom_account_id` (for API calls)
- Config validation
- No direct chat API interaction (that's handled by the simulator)

**Register in**: `get_model_manager.py`
```python
"MODEL_TYPE_ZVA_CHAT": ZvaChatModelManager.ZvaChatModelManager,
```

### 3.3 ZVA Chat Simulator

**File**: `backend/evaluation_pipeline/simulation/simulator/zva_chat_simulator.py`

This is the most novel component. Two sub-implementations:

#### Option A: `ZvaTranscriptImportSimulator`
- Pulls transcripts via ZVA Reporting API
- Normalizes to Coval transcript format
- No actual simulation — just import and conversion
- Fast, works with existing data

#### Option B: `ZvaBrowserSimulator`
- Launches headless Playwright browser
- Navigates to the ZVA-enabled page (the test site we deployed, or customer's site)
- Waits for SDK initialization
- Interacts with chat widget: types messages, reads responses
- Uses Coval persona prompts to drive the conversation (LLM generates "user" messages)
- Captures full transcript with timestamps
- Detects engagement end via SDK events

**Register in**: `simulator_registry.py`
```python
SIMULATOR_TYPE_ZVA_CHAT = "MODEL_TYPE_ZVA_CHAT"

# Add to V2_SIMULATOR_TYPES
V2_SIMULATOR_TYPES.append(SIMULATOR_TYPE_ZVA_CHAT)

# Add to registry
_SIMULATOR_REGISTRY[SIMULATOR_TYPE_ZVA_CHAT] = SimulatorConfig(
    module_path="simulation.simulator.zva_chat_simulator",
    class_name="ZvaChatSimulator",
)
```

#### Browser Simulator Architecture

```
ZvaChatSimulator
├── _simulate()
│   ├── Launch Playwright (headless Chromium)
│   ├── Navigate to ZVA-enabled page
│   ├── Wait for SDK ready (poll for window.zoomCampaignSdk)
│   ├── Open chat widget (sdk.show() or click invitation)
│   ├── Conversation loop:
│   │   ├── Read agent message from DOM
│   │   ├── Send to Coval persona LLM for response
│   │   ├── Type persona response into chat input
│   │   ├── Wait for agent reply
│   │   ├── Check termination conditions
│   │   └── Record transcript entry
│   ├── End engagement
│   └── Return SimulationResult with transcript
```

#### Key Considerations for Browser Simulator:
- **Concurrency**: Playwright supports multiple browser contexts; use semaphore similar to voice simulator
- **Widget DOM selectors**: The ZVA SDK renders a chat widget with predictable structure. Selectors may need updating if Zoom changes their SDK.
- **Timeouts**: Agent responses may be slow; configurable timeout per turn
- **Rate limiting**: Zoom may rate-limit widget interactions
- **Lambda compatibility**: Playwright can run in Lambda with the `playwright-aws-lambda` package, or use EC2 workers

### 3.4 ZVA-Specific Metrics

Beyond standard text metrics (LLM judge, workflow test), ZVA provides unique data:

| Metric | Source | Description |
|--------|--------|-------------|
| `zva_intent_accuracy` | Query details API | How accurately ZVA matched intents |
| `zva_kb_retrieval_quality` | Query details API | Relevance of KB articles served |
| `zva_resolution_rate` | Engagement API | `implicit_resolution` field |
| `zva_engagement_duration` | Engagement API | Time to resolution |
| `zva_survey_score` | Survey API | Post-chat survey ratings |
| `zva_transfer_rate` | Engagement API | Rate of handoff to live agents |

These can be implemented as new `MetricManager` subclasses or as LLM judge variants.

### 3.5 Transcript Import Service

**File**: `backend/evaluation_pipeline/services/zva_transcript_service.py`

```python
class ZvaTranscriptService:
    """Service for importing ZVA transcripts via Zoom API."""

    def __init__(self, oauth_token: str, base_url: str = "https://api.zoom.us/v2"):
        self.oauth_token = oauth_token
        self.base_url = base_url

    def fetch_transcripts(self, from_dt, to_dt, agent_types=None, page_size=100):
        """Fetch transcripts from ZVA Reporting API."""
        # GET /virtual_agent/report/transcripts

    def fetch_engagements(self, from_dt, to_dt, page_size=100):
        """Fetch engagement metadata."""
        # GET /virtual_agent/report/engagements

    def fetch_query_details(self, engagement_ids):
        """Fetch intent/KB details for engagements."""
        # GET /virtual_agent/report/engagements/query_details

    def normalize_transcript(self, zva_transcript) -> CovalTranscript:
        """Convert ZVA transcript format to Coval format."""
```

---

## 4. Frontend Integration Points

### 4.1 SimulatorType Enum

**File**: `frontend/types_api/SimulatorType.ts`

```typescript
export enum SimulatorType {
  // ... existing types ...
  ZVA_CHAT = "MODEL_TYPE_ZVA_CHAT",
}
```

### 4.2 ZVA Simulator Config Component

**File**: `frontend/features/agents/components/simulators/ZvaChatSimulatorConfig.tsx`

Fields:
- **Mode selector**: "Live Simulation" vs "Transcript Import"
- **For Live Simulation**:
  - `zva_site_url` (URL of the page with ZVA widget) — required
  - `zva_api_key` (Campaign API key) — display only, read from agent config
- **For Transcript Import**:
  - Zoom OAuth connection (OAuth flow or paste token)
  - Date range picker for transcript fetch
  - Agent type filter (`chat`, `ai_chat`, `ai_voice`)
- **Common**:
  - `zva_env` selector (`us01` / `eu01`)

### 4.3 Agent Setup

When creating a ZVA agent in Coval, the user provides:
- Agent name
- Model type: `ZVA_CHAT`
- Metadata:
  - `zva_api_key`: Their campaign API key
  - `zva_env`: Data center
  - `zva_site_url`: URL hosting the widget (e.g., `https://zva-test.vercel.app`)
  - `zoom_account_id`: For API access
- OAuth credentials stored securely for transcript import

---

## 5. Implementation Phases

### Phase 1: Transcript Import (Fastest path to value)
1. Build `ZvaTranscriptService` for API integration
2. Create transcript normalization (ZVA → Coval format)
3. Add `MODEL_TYPE_ZVA_CHAT` to model manager factory
4. Create `ZvaChatModelManager` with config extraction
5. Create `ZvaTranscriptImportSimulator` (pulls and normalizes transcripts)
6. Add frontend `SimulatorType.ZVA_CHAT` and basic config UI
7. Test with real ZVA transcripts (requires Zoom account access)

**Existing metrics that work immediately**: LLM Judge, Binary LLM Judge, Workflow Test

### Phase 2: Live Browser Simulation
1. Add Playwright dependency to simulation workers
2. Build `ZvaBrowserSimulator` with chat widget interaction
3. Handle widget DOM selectors and message extraction
4. Integrate with Coval persona system for LLM-driven conversation
5. Add concurrency controls (browser instances are heavier than HTTP calls)
6. Test end-to-end: persona ↔ ZVA widget ↔ transcript ↔ metrics

### Phase 3: ZVA-Specific Metrics
1. Build query detail ingestion (intent accuracy, KB quality)
2. Create ZVA-specific metric managers
3. Add engagement-level metrics (resolution rate, transfer rate, duration)
4. Survey score ingestion
5. Dashboard widgets for ZVA analytics

### Phase 4: Production Hardening
1. OAuth token refresh flow
2. Playwright in Lambda (or dedicated EC2 pool)
3. Widget selector resilience (version detection, fallback selectors)
4. Rate limiting and retry logic for Zoom APIs
5. Multi-environment support (us01/eu01)

---

## 6. Dependencies & Prerequisites

| Dependency | Phase | Notes |
|-----------|-------|-------|
| Zoom Contact Center license | All | Required for ZVA access |
| Zoom OAuth app credentials | Phase 1 | For API access (Server-to-Server OAuth) |
| Playwright | Phase 2 | `pip install playwright && playwright install chromium` |
| ZVA test site deployed | Phase 2 | Already done: https://zva-test.vercel.app |
| ZVA Campaign API key | Phase 2 | From Zoom admin portal |

---

## 7. Key Files to Create/Modify

### New Files (Backend)
- `backend/evaluation_pipeline/models/ZvaChatModelManager.py`
- `backend/evaluation_pipeline/simulation/simulator/zva_chat_simulator.py`
- `backend/evaluation_pipeline/services/zva_transcript_service.py`
- `backend/evaluation_pipeline/metrics/zva_metrics/` (Phase 3)

### Modified Files (Backend)
- `backend/evaluation_pipeline/models/get_model_manager.py` — add ZVA entry
- `backend/evaluation_pipeline/simulation/simulator/simulator_registry.py` — register ZVA simulator
- `backend/evaluation_pipeline/model_type_constants.py` — add constant

### New Files (Frontend)
- `frontend/features/agents/components/simulators/ZvaChatSimulatorConfig.tsx`

### Modified Files (Frontend)
- `frontend/types_api/SimulatorType.ts` — add ZVA_CHAT enum
- Template/launcher components to wire up ZVA config

---

## 8. ZVA API Reference (for implementation)

**Base URL**: `https://api.zoom.us/v2`
**Auth**: OAuth 2.0 Bearer Token (Server-to-Server)

### Endpoints Used

| Endpoint | Rate Limit | Purpose |
|----------|-----------|---------|
| `GET /virtual_agent/report/transcripts` | HEAVY | Full conversation transcripts |
| `GET /virtual_agent/report/engagements` | HEAVY | Engagement metadata |
| `GET /virtual_agent/report/engagements/query_details` | HEAVY | Intent/KB details |
| `GET /virtual_agent/report/engagements/variables` | HEAVY | Variable values |
| `GET /virtual_agent/report/surveys` | HEAVY | Survey responses |

### Transcript Response Shape
```json
{
  "transcripts": [{
    "engagement_id": "string",
    "channel": "Chat Agent | Voice Agent | Classic ChatBot",
    "start_time": "datetime",
    "end_time": "datetime",
    "total_duration": 120,
    "interaction_duration": 95,
    "messages": [{
      "sender": "AI Agent | Bot | Consumer",
      "timestamp": "datetime",
      "message_type": "string",
      "text": "string",
      "kb_articles": [{"title": "string", "url": "string"}]
    }]
  }]
}
```

### Engagement Response Shape
```json
{
  "engagements": [{
    "engagement_id": "string",
    "duration": 120,
    "campaign_name": "string",
    "outcome": "string",
    "implicit_resolution": "RESOLVED | NOT_RESOLVED",
    "interaction_turns": 8,
    "agent_messages_sent": 5,
    "consumer_messages_sent": 3,
    "transfer_accepted": false,
    "agents": [{"agent_type": "string", "agent_name": "string"}],
    "tools": ["string"],
    "skills": ["string"],
    "articles": ["string"],
    "topics": ["string"]
  }]
}
```
