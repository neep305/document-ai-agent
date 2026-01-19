# Copilot Instructions for Adobe Tagging AI

## Project Overview

**Adobe Tagging AI** automates Adobe Analytics implementation documentation using LangGraph-based AI workflows. It generates structured documents (BRD/SDR, TSD, QA reports) from initial requirements, reducing manual documentation effort by ~70%.

### Core Architecture

This is a **multi-stage document pipeline**:
1. **Discovery** → 2. **BRD/SDR** → 3. **TSD** → 4. **Validation** → 5. **Go-Live**

Each stage in [base-docs/](base-docs/) contains Excel/Word templates. AI agents transform input documents through reasoning workflows to generate downstream deliverables.

**Key Pattern**: Discovery (Excel) → AI Analysis → AI Reasoning → BRD/SDR Generation → Validation Loop

## Development Environment

### Package Management - ALWAYS use UV

This project uses **UV** (not pip) for dependency management:

```bash
# Install dependencies and create .venv
uv sync

# Run scripts
uv run python run_sample.py

# Add dependencies
uv add package-name
```

⚠️ **Never** use `pip install` - always use `uv add` to update [pyproject.toml](pyproject.toml)

### Running the Demo

```bash
# Ensure OPENAI_API_KEY is set
uv run python run_sample.py
```

Expected workflow: Load sample data → Analyze → Reason → Generate → Validate → Save to `output/`

## Code Organization

### LangGraph Workflow Pattern ([src/workflows/brd_sdr_workflow.py](src/workflows/brd_sdr_workflow.py))

All document generation follows this **state machine pattern**:

```python
WorkflowState (TypedDict) → StateGraph with nodes → Conditional edges → Compile
```

**Standard workflow nodes**:
1. `analyze` - Extract requirements from input
2. `reason` - Step-by-step solution design (chain-of-thought)
3. `generate` - Create document from reasoning
4. `validate` - Quality check (score 0-10)
5. `revise` - Conditional node if validation < 8

**Critical**: Each node returns updated `WorkflowState` - NEVER mutate state directly.

### Prompt Engineering ([src/prompts/brd_sdr_prompts.py](src/prompts/brd_sdr_prompts.py))

All AI prompts are **centralized** here, not scattered in workflow code:
- `ANALYSIS_PROMPT` - Structured JSON extraction
- `REASONING_PROMPT` - Step-by-step solution design (e-commerce focus)
- `BRD_SDR_GENERATION_PROMPT` - Document generation with specific sections
- `VALIDATION_PROMPT` - Quality scoring with feedback

**Pattern**: Prompts include context injection placeholders: `{discovery_content}`, `{analysis}`, `{reasoning}`

### Sample Data ([src/utils/sample_data.py](src/utils/sample_data.py))

Sample e-commerce discovery document for testing. Structure:
- `client_info` - Company metadata
- `business_objectives` - Goals array
- `key_kpis` - Metrics with targets
- `user_journeys` - Step-by-step flows

**Use this** when testing new workflows - mirrors real Discovery template structure.

## Platform-Specific Implementation

### Multi-Platform Support

Adobe implementations vary by platform:
- **Web SDK** - JavaScript/Experience Platform Web SDK
- **Mobile Edge SDK** - Android (Kotlin) / iOS (Swift)
- **Flutter** - Cross-platform mobile

**TSD documents** ([base-docs/3_tsd/](base-docs/3_tsd/)) must be generated per-platform with platform-specific code samples.

### Document Formats

- **Stages 1-2** (Discovery, BRD/SDR): Excel (.xlsx) via `openpyxl`
- **Stage 3** (TSD): Word (.docx) via `python-docx`
- **Stages 4-5** (Validation, Go-Live): Excel (.xlsx)

Use appropriate library based on stage - check [base-docs/](base-docs/) structure for format.

## n8n Integration (Parallel System)

The [n8n-cloud/](n8n-cloud/) directory contains a **separate** no-code automation system:

- Webhook-based workflows for non-technical users
- Excel file upload → AI processing → Excel download
- Uses OpenAI API directly (not LangGraph)
- Cloud deployment via Cloudflare tunneling

**Key files**:
- [n8n-cloud/v0.3/BRD_to_SDR_Workflow_Complete.json](n8n-cloud/v0.3/BRD_to_SDR_Workflow_Complete.json) - Production workflow
- [n8n-cloud/v0.3/COMPLETE_WORKFLOW_GUIDE.md](n8n-cloud/v0.3/COMPLETE_WORKFLOW_GUIDE.md) - Deployment guide

**Note**: n8n workflows are **independent** of Python codebase - they share concepts but not implementation.

## Critical Conventions

### 1. LangGraph Temperature Setting

Always use `temperature=0.3` in ChatOpenAI initialization ([src/workflows/brd_sdr_workflow.py:53-55](src/workflows/brd_sdr_workflow.py#L53-L55)):

```python
self.llm = ChatOpenAI(
    model=self.model,
    temperature=0.3,  # Lower for consistency
    max_tokens=8000
)
```

Higher temperatures cause validation failures due to inconsistent output structure.

### 2. Output File Naming

All generated files use timestamp prefix: `YYYYMMDD_HHMMSS_<stage>_<type>.<ext>`

Example: `20241126_120000_4_BRD_SDR_final.md`

See [run_sample.py:14-21](run_sample.py#L14-L21) for implementation.

### 3. Bilingual Documentation

- **PROJECT.md** - Korean (client-facing)
- **Technical docs, code comments** - English
- **Generated documents** - Follow template language (usually English)

Maintain language consistency within each document type.

## Testing and Validation

### Quality Validation Pattern

Every workflow includes self-validation with **revision loop**:

```python
if validation_score < 8:
    needs_revision = True
    # Retry up to 2 times with feedback
```

Validation checks ([src/workflows/brd_sdr_workflow.py:138-178](src/workflows/brd_sdr_workflow.py#L138-L178)):
- Completeness (all required sections)
- Specificity (actual values vs placeholders)
- Consistency (no contradictions)
- Adobe best practices alignment

### Running Tests

```bash
# Sample workflow test
uv run python run_sample.py

# Check output/ directory for generated files
```

Expected: 5 files in `output/` with quality score ≥ 8/10.

## Adding New Document Types

To add a new document generation workflow (e.g., TSD):

1. Create prompt file in [src/prompts/](src/prompts/) with all stages
2. Create workflow class in [src/workflows/](src/workflows/) extending the pattern
3. Define `WorkflowState` TypedDict with needed fields
4. Implement 5-node pattern: analyze → reason → generate → validate → revise
5. Add sample data to [src/utils/](src/utils/) for testing
6. Create run script similar to [run_sample.py](run_sample.py)

**Reference**: [src/workflows/brd_sdr_workflow.py](src/workflows/brd_sdr_workflow.py) is the canonical example.

## Common Issues

### "OPENAI_API_KEY not found"

Set in `.env` file (copy from `.env.example`):
```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

### UV commands not working

UV must be installed first:
```bash
# Windows PowerShell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

See [UV_SETUP.md](UV_SETUP.md) for details.

### n8n workflow 500 errors

Check [n8n-cloud/v0.3/DEBUG_500_ERROR.md](n8n-cloud/v0.3/DEBUG_500_ERROR.md) - usually ExcelJS installation issue in Docker container.
