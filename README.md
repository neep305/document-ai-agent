# Adobe Tagging AI

AI-powered documentation workflow system for Adobe Analytics implementation projects.

## 🎯 Project Overview

Automates the generation of Adobe Analytics implementation documents from initial requirements through to QA reporting, reducing manual documentation effort in Adobe Analytics tagging projects.

## 🏗️ Architecture

Built with **LangGraph** for multi-step reasoning workflows:

```
Discovery Document → [Analysis] → [Reasoning] → [Generation] → [Validation] → BRD/SDR
```

### Key Features

- ✅ **Chain-of-Thought Reasoning**: AI analyzes requirements and reasons through solution design
- ✅ **Self-Validation**: Automatic quality checking with revision loops
- ✅ **State Management**: Clear tracking of each workflow step
- ✅ **Extensible**: Easy to add new document generation workflows

## 📦 Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd adobe-tagging-ai
```

### 2. Install dependencies with UV

```bash
# Install UV if you haven't already
# macOS/Linux:
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows:
# powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# Sync dependencies (creates venv automatically)
uv sync
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o
```

### 4. Run the sample

```bash
uv run python run_sample.py
```

## 🚀 Quick Start

### Option 1: Using UV (Recommended - Fastest!)

```bash
# One command does it all!
uv run python run_sample.py
```

### Option 2: Using pip (Traditional)

```bash
# Activate venv first
source .venv/bin/activate  # or venv/bin/activate

# Run
python run_sample.py
```

💡 **New to UV?** Check out [UV_SETUP.md](UV_SETUP.md) for detailed guide.

This will:
1. Load sample e-commerce discovery data
2. Run the LangGraph workflow (Analysis → Reasoning → Generation → Validation)
3. Generate a complete BRD/SDR document
4. Save all outputs to `./output/` directory

### Expected Output

```
output/
├── 20241126_120000_1_discovery_input.json
├── 20241126_120000_2_analysis.txt
├── 20241126_120000_3_reasoning.txt
├── 20241126_120000_4_BRD_SDR_final.md
└── 20241126_120000_5_validation_result.json
```

## 📁 Project Structure

```
adobe-tagging-ai/
├── base-docs/              # Template documents by workflow stage
│   ├── 1_discovery/       # Project discovery templates
│   ├── 2_brd_sdr/         # BRD/SDR templates
│   ├── 3_tsd/             # Technical specs (Web/Mobile)
│   ├── 4_validation/      # QA validation docs
│   └── 5_go_live/         # Go-live checklists
├── src/
│   ├── workflows/         # LangGraph workflows
│   ├── prompts/           # LLM prompts
│   ├── processors/        # Document processors
│   ├── core/              # Core modules
│   └── utils/             # Utilities & sample data
├── output/                # Generated documents
├── tests/                 # Test files
├── run_sample.py          # Demo script
└── requirements.txt
```

## 🔧 Usage

### Using the BRD/SDR Workflow

```python
from src.workflows.brd_sdr_workflow import BRDSDRWorkflow

# Initialize workflow
workflow = BRDSDRWorkflow(api_key="your-api-key")

# Prepare discovery data (dict or JSON string)
discovery_data = {
    "client_info": {...},
    "business_objectives": [...],
    # ... more discovery data
}

# Run workflow
result = workflow.run(discovery_data)

# Access outputs
print(result["analysis"])      # Analysis step output
print(result["reasoning"])     # Reasoning step output
print(result["brd_sdr_final"]) # Final BRD/SDR document
print(result["validation_result"])  # Quality validation
```

### Customizing Prompts

Edit prompts in [src/prompts/brd_sdr_prompts.py](src/prompts/brd_sdr_prompts.py):

- `ANALYSIS_PROMPT`: How to analyze discovery documents
- `REASONING_PROMPT`: Chain-of-thought reasoning for solution design
- `BRD_SDR_GENERATION_PROMPT`: Document generation instructions
- `VALIDATION_PROMPT`: Quality validation criteria

## 🧪 Sample Data

The project includes sample e-commerce discovery data in [src/utils/sample_data.py](src/utils/sample_data.py):

- **Company**: ShopKorea (Fashion & Lifestyle E-commerce)
- **Platforms**: Web (React SPA), Native Mobile (iOS/Android)
- **Key KPIs**: Conversion rate, AOV, cart abandonment, etc.
- **User Journeys**: Product discovery, purchase, account management

## 🔄 Workflow Stages

### Current: Discovery → BRD/SDR

1. **Analysis**: Extract business context, KPIs, technical constraints
2. **Reasoning**: Chain-of-thought solution design (events, variables, data layer)
3. **Generation**: Create comprehensive BRD/SDR document
4. **Validation**: Quality check with automatic revision if needed

### Coming Soon

- BRD/SDR → TSD (Technical Specification) + Platform Code
- TSD → QA Validation
- QA → Report Generation

## 🛠️ Technology Stack

- **LangGraph**: Workflow orchestration with state management
- **LangChain**: LLM framework and tooling
- **OpenAI GPT-4o**: Language model
- **ChromaDB**: Vector database for RAG (future)
- **Python 3.9+**: Core language

## 📝 Document Types

- **Discovery**: Initial requirements gathering
- **BRD/SDR**: Business Requirements + Solution Design Reference
- **TSD**: Technical Specification Document (with implementation code)
- **Validation**: QA test documents
- **Go-Live**: Deployment checklists

## 🎓 Learning Resources

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Adobe Analytics Documentation](https://experienceleague.adobe.com/docs/analytics.html)
- [OpenAI API Documentation](https://platform.openai.com/docs)

## 📄 License

[Add your license here]
