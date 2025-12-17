"""
LangGraph workflow for generating BRD/SDR from Discovery document
"""

import json
import os
from typing import TypedDict, Annotated
from typing_extensions import TypedDict

from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from src.prompts.brd_sdr_prompts import (
    ANALYSIS_PROMPT,
    REASONING_PROMPT,
    BRD_SDR_GENERATION_PROMPT,
    VALIDATION_PROMPT
)


class WorkflowState(TypedDict):
    """State definition for the BRD/SDR generation workflow"""
    discovery_content: str
    analysis: str
    reasoning: str
    brd_sdr_draft: str
    brd_sdr_final: str
    validation_result: dict
    needs_revision: bool
    iteration_count: int


class BRDSDRWorkflow:
    """LangGraph workflow for Discovery → BRD/SDR generation with reasoning"""

    def __init__(self, api_key: str = None, model: str = None):
        """
        Initialize the workflow

        Args:
            api_key: OpenAI API key (if None, will use OPENAI_API_KEY env var)
            model: OpenAI model to use (if None, will use OPENAI_MODEL env var or default to gpt-4o)
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY must be provided or set in environment")

        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o")

        self.llm = ChatOpenAI(
            api_key=self.api_key,
            model=self.model,
            temperature=0.3,  # Lower temperature for more consistent output
            max_tokens=8000
        )

        # Build the graph
        self.workflow = self._build_graph()

    def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow"""

        # Create the graph
        workflow = StateGraph(WorkflowState)

        # Add nodes
        workflow.add_node("analyze", self._analyze_discovery)
        workflow.add_node("reason", self._reason_solution_design)
        workflow.add_node("generate", self._generate_brd_sdr)
        workflow.add_node("validate", self._validate_document)
        workflow.add_node("revise", self._revise_document)

        # Define the flow
        workflow.set_entry_point("analyze")
        workflow.add_edge("analyze", "reason")
        workflow.add_edge("reason", "generate")
        workflow.add_edge("generate", "validate")

        # Conditional edge: revise or finish
        workflow.add_conditional_edges(
            "validate",
            self._should_revise,
            {
                "revise": "revise",
                "end": END
            }
        )
        workflow.add_edge("revise", END)

        return workflow.compile()

    def _analyze_discovery(self, state: WorkflowState) -> WorkflowState:
        """Step 1: Analyze the discovery document"""
        print("📊 Step 1: Analyzing discovery document...")

        prompt = ANALYSIS_PROMPT.format(
            discovery_content=state["discovery_content"]
        )

        response = self.llm.invoke([HumanMessage(content=prompt)])
        state["analysis"] = response.content

        print(f"✓ Analysis complete ({len(response.content)} chars)")
        return state

    def _reason_solution_design(self, state: WorkflowState) -> WorkflowState:
        """Step 2: Apply Chain-of-Thought reasoning to design the solution"""
        print("🧠 Step 2: Reasoning through solution design...")

        prompt = REASONING_PROMPT.format(
            analysis=state["analysis"],
            discovery_content=state["discovery_content"]
        )

        response = self.llm.invoke([HumanMessage(content=prompt)])
        state["reasoning"] = response.content

        print(f"✓ Reasoning complete ({len(response.content)} chars)")
        return state

    def _generate_brd_sdr(self, state: WorkflowState) -> WorkflowState:
        """Step 3: Generate the BRD/SDR document"""
        print("📝 Step 3: Generating BRD/SDR document...")

        prompt = BRD_SDR_GENERATION_PROMPT.format(
            discovery_content=state["discovery_content"],
            analysis=state["analysis"],
            reasoning=state["reasoning"]
        )

        response = self.llm.invoke([HumanMessage(content=prompt)])
        state["brd_sdr_draft"] = response.content

        print(f"✓ BRD/SDR draft generated ({len(response.content)} chars)")
        return state

    def _validate_document(self, state: WorkflowState) -> WorkflowState:
        """Step 4: Validate the generated document"""
        print("🔍 Step 4: Validating BRD/SDR document...")

        prompt = VALIDATION_PROMPT.format(
            discovery_content=state["discovery_content"],
            brd_sdr=state["brd_sdr_draft"]
        )

        response = self.llm.invoke([HumanMessage(content=prompt)])

        # Try to extract quality score and issues
        validation_text = response.content

        # Simple parsing (in production, would use structured output)
        quality_score = 8  # Default
        if "quality score" in validation_text.lower():
            # Extract score if present
            import re
            score_match = re.search(r'quality score[:\s]+(\d+)', validation_text.lower())
            if score_match:
                quality_score = int(score_match.group(1))

        state["validation_result"] = {
            "score": quality_score,
            "feedback": validation_text
        }

        # Initialize iteration_count if not present
        if "iteration_count" not in state:
            state["iteration_count"] = 0

        # Decide if revision is needed (score < 8 and < 2 iterations)
        state["needs_revision"] = quality_score < 8 and state["iteration_count"] < 2

        print(f"✓ Validation complete (score: {quality_score}/10)")

        if not state["needs_revision"]:
            state["brd_sdr_final"] = state["brd_sdr_draft"]

        return state

    def _revise_document(self, state: WorkflowState) -> WorkflowState:
        """Step 5: Revise the document based on validation feedback"""
        print("✏️  Step 5: Revising document based on feedback...")

        state["iteration_count"] += 1

        revision_prompt = f"""
        Revise the following BRD/SDR document based on the validation feedback.

        ORIGINAL DOCUMENT:
        {state["brd_sdr_draft"]}

        VALIDATION FEEDBACK:
        {state["validation_result"]["feedback"]}

        Provide an improved version addressing all the issues mentioned.
        """

        response = self.llm.invoke([HumanMessage(content=revision_prompt)])
        state["brd_sdr_final"] = response.content

        print(f"✓ Revision complete (iteration {state['iteration_count']})")
        return state

    def _should_revise(self, state: WorkflowState) -> str:
        """Determine if document needs revision"""
        return "revise" if state.get("needs_revision", False) else "end"

    def run(self, discovery_content: str) -> dict:
        """
        Run the workflow

        Args:
            discovery_content: Discovery document content (string or dict)

        Returns:
            Final state with generated BRD/SDR
        """
        # Convert dict to formatted string if needed
        if isinstance(discovery_content, dict):
            discovery_content = json.dumps(discovery_content, indent=2)

        initial_state = {
            "discovery_content": discovery_content,
            "analysis": "",
            "reasoning": "",
            "brd_sdr_draft": "",
            "brd_sdr_final": "",
            "validation_result": {},
            "needs_revision": False,
            "iteration_count": 0
        }

        print("🚀 Starting BRD/SDR generation workflow...\n")

        final_state = self.workflow.invoke(initial_state)

        print("\n✅ Workflow completed successfully!")
        return final_state
