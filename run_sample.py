"""
Sample script to run the BRD/SDR generation workflow
"""

import os
import json
from datetime import datetime
from dotenv import load_dotenv

from src.workflows.brd_sdr_workflow import BRDSDRWorkflow
from src.utils.sample_data import SAMPLE_ECOMMERCE_DISCOVERY


def save_output(content: str, filename: str):
    """Save output to file"""
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)

    filepath = os.path.join(output_dir, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"💾 Saved to: {filepath}")
    return filepath


def main():
    """Run the sample workflow"""

    # Load environment variables
    load_dotenv()

    # Check for API key
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("❌ Error: OPENAI_API_KEY not found in environment variables")
        print("   Please create a .env file with your API key:")
        print("   OPENAI_API_KEY=your_api_key_here")
        return

    # Get model
    model = os.getenv("OPENAI_MODEL", "gpt-4o")

    print("=" * 80)
    print("Adobe Tagging AI - BRD/SDR Generation Demo")
    print("=" * 80)
    print()
    print(f"🤖 Using model: {model}")
    print()

    # Display sample data info
    print("📋 Using sample e-commerce discovery data:")
    print(f"   Company: {SAMPLE_ECOMMERCE_DISCOVERY['client_info']['company_name']}")
    print(f"   Industry: {SAMPLE_ECOMMERCE_DISCOVERY['client_info']['industry']}")
    print(f"   Platforms: {', '.join(SAMPLE_ECOMMERCE_DISCOVERY['client_info']['platforms'])}")
    print()

    # Initialize workflow
    workflow = BRDSDRWorkflow(api_key=api_key, model=model)

    # Run workflow
    try:
        result = workflow.run(SAMPLE_ECOMMERCE_DISCOVERY)

        # Save all outputs
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        print("\n" + "=" * 80)
        print("📊 Saving results...")
        print("=" * 80)

        # Save discovery input
        save_output(
            json.dumps(SAMPLE_ECOMMERCE_DISCOVERY, indent=2),
            f"{timestamp}_1_discovery_input.json"
        )

        # Save analysis
        save_output(
            result["analysis"],
            f"{timestamp}_2_analysis.txt"
        )

        # Save reasoning
        save_output(
            result["reasoning"],
            f"{timestamp}_3_reasoning.txt"
        )

        # Save final BRD/SDR
        brd_sdr_output = result.get("brd_sdr_final") or result.get("brd_sdr_draft")
        save_output(
            brd_sdr_output,
            f"{timestamp}_4_BRD_SDR_final.md"
        )

        # Save validation results
        save_output(
            json.dumps(result["validation_result"], indent=2),
            f"{timestamp}_5_validation_result.json"
        )

        print("\n" + "=" * 80)
        print("✅ SUCCESS!")
        print("=" * 80)
        print()
        print(f"📈 Quality Score: {result['validation_result'].get('score', 'N/A')}/10")
        print(f"🔄 Iterations: {result.get('iteration_count', 0)}")
        print()
        print("📁 All files saved to ./output/")
        print()

        # Display preview of final document
        print("=" * 80)
        print("📄 BRD/SDR Preview (first 1000 characters):")
        print("=" * 80)
        print()
        print(brd_sdr_output[:1000])
        print("\n... (see full document in output file) ...")
        print()

    except Exception as e:
        print(f"\n❌ Error running workflow: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
