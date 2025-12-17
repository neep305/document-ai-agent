# 🚀 Quick Start Guide

## Prerequisites

- Python 3.9 or higher
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

## Installation (3 minutes with UV)

### Step 1: Install UV (if not already installed)

```bash
# macOS/Linux:
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows:
# powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### Step 2: Install dependencies

```bash
# UV will automatically create venv and install all dependencies
uv sync
```

### Step 3: Configure API key

```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your API key
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o
```

Or set it directly in your shell:

```bash
export OPENAI_API_KEY="sk-your-key-here"
export OPENAI_MODEL="gpt-4o"
```

## Run the Demo

```bash
uv run python run_sample.py
```

Or if you prefer to activate the venv manually:

```bash
source .venv/bin/activate  # UV creates .venv by default
python run_sample.py
```

Expected output:
```
================================================================================
Adobe Tagging AI - BRD/SDR Generation Demo
================================================================================

📋 Using sample e-commerce discovery data:
   Company: ShopKorea
   Industry: E-commerce
   Platforms: Web, Mobile App (iOS/Android)

🚀 Starting BRD/SDR generation workflow...

📊 Step 1: Analyzing discovery document...
✓ Analysis complete (XXXX chars)

🧠 Step 2: Reasoning through solution design...
✓ Reasoning complete (XXXX chars)

📝 Step 3: Generating BRD/SDR document...
✓ BRD/SDR draft generated (XXXX chars)

🔍 Step 4: Validating BRD/SDR document...
✓ Validation complete (score: 9/10)

✅ Workflow completed successfully!

================================================================================
📊 Saving results...
================================================================================
💾 Saved to: output/20241126_120000_1_discovery_input.json
💾 Saved to: output/20241126_120000_2_analysis.txt
💾 Saved to: output/20241126_120000_3_reasoning.txt
💾 Saved to: output/20241126_120000_4_BRD_SDR_final.md
💾 Saved to: output/20241126_120000_5_validation_result.json

================================================================================
✅ SUCCESS!
================================================================================

📈 Quality Score: 9/10
🔄 Iterations: 0

📁 All files saved to ./output/
```

## Check the Results

```bash
# View the generated BRD/SDR
cat output/*_BRD_SDR_final.md

# Or open in your editor
code output/  # VS Code
```

## Next Steps

1. **Examine the outputs** in the `output/` directory:
   - See how the AI analyzed the discovery doc
   - Read the reasoning steps
   - Review the final BRD/SDR document

2. **Customize the sample data** in `src/utils/sample_data.py`

3. **Modify prompts** in `src/prompts/brd_sdr_prompts.py` to change the output style

4. **Build your own workflow** by extending `src/workflows/`

## Troubleshooting

### "OPENAI_API_KEY not found"
- Make sure you created `.env` file with your API key
- Or export it: `export OPENAI_API_KEY="your-key"`

### Import errors
- Reinstall with UV: `uv sync --reinstall`
- Or activate venv: `source .venv/bin/activate`

### Rate limit errors
- The workflow makes multiple LLM calls
- Wait a few seconds and retry
- Or use a different model in `src/workflows/brd_sdr_workflow.py`

## Understanding the Workflow

The LangGraph workflow has 4 main steps:

```
1. ANALYZE      → Extract business requirements, KPIs, constraints
2. REASON       → Chain-of-thought design decisions (events, variables)
3. GENERATE     → Create comprehensive BRD/SDR document
4. VALIDATE     → Quality check (auto-revise if score < 8)
```

Each step's output is saved separately so you can see the AI's thinking process.

## Cost Estimate

- Sample workflow: ~4 LLM calls
- Total tokens: ~15,000 - 25,000 tokens
- Estimated cost: $0.15 - $0.30 per run (GPT-4o)

## Support

For issues or questions, please check:
- [README.md](README.md) for detailed documentation
- [CLAUDE.md](CLAUDE.md) for project context
- [base-docs/PROJECT.md](base-docs/PROJECT.md) for project overview (Korean)
