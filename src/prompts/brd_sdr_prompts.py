"""
Prompts for BRD/SDR generation from Discovery document
"""

ANALYSIS_PROMPT = """You are an Adobe Analytics expert consultant analyzing a client's discovery document.

DISCOVERY DOCUMENT:
{discovery_content}

Your task is to analyze this discovery document and extract:

1. Business Context
   - What is the client trying to achieve?
   - What are their pain points?
   - What industry/vertical are they in?

2. Measurement Requirements
   - What KPIs need to be tracked?
   - What user behaviors are critical?
   - What data points are required?

3. Technical Constraints
   - What platforms need to be tracked? (Web/Mobile/App)
   - What is the technical environment?
   - Are there any integration requirements?

4. Success Criteria
   - How will we measure success?
   - What are the acceptance criteria?

Provide a structured analysis in JSON format with these sections.
"""

REASONING_PROMPT = """You are an Adobe Analytics solution architect designing an implementation strategy.

ANALYSIS:
{analysis}

DISCOVERY CONTEXT:
{discovery_content}

Think step-by-step to design an Adobe Analytics solution:

Step 1: Event Design
- What events need to be tracked for this business?
- Which events are standard (pageview, link clicks) vs custom events?
- How should events be prioritized?

Step 2: Variable Allocation
- What eVars are needed and for what purpose?
- What props should be used?
- What success events need to be configured?

Step 3: Data Layer Design
- What should the data layer structure look like?
- What values need to be captured on each page/interaction?
- How should data be organized for scalability?

Step 4: Implementation Strategy
- What is the recommended implementation approach?
- What are the dependencies and prerequisites?
- What testing strategy should be used?

Provide your reasoning with clear justifications for each decision.
Focus on e-commerce best practices for Adobe Analytics.
"""

BRD_SDR_GENERATION_PROMPT = """You are creating a Business Requirements Document (BRD) and Solution Design Reference (SDR) for Adobe Analytics implementation.

DISCOVERY DOCUMENT:
{discovery_content}

ANALYSIS:
{analysis}

REASONING & DESIGN DECISIONS:
{reasoning}

Create a comprehensive BRD/SDR document with the following structure:

## 1. EXECUTIVE SUMMARY
- Project overview
- Business objectives
- Expected outcomes

## 2. BUSINESS REQUIREMENTS
- Key business questions to answer
- Critical KPIs and metrics
- User journeys to track
- Success criteria

## 3. SOLUTION DESIGN OVERVIEW
- Adobe Analytics configuration approach
- Tracking methodology
- Data collection strategy

## 4. DETAILED TRACKING SPECIFICATIONS

### 4.1 Events Tracking
For each event, specify:
- Event name
- Trigger condition
- Business purpose
- Priority (P0/P1/P2)

### 4.2 Variables (eVars & Props)
For each variable, specify:
- Variable name
- Variable type (eVar/prop)
- Allocation type (Most Recent, Original Value, Linear, etc.)
- Expiration
- Purpose and usage
- Sample values

### 4.3 Success Events
- Custom event definitions
- Counter vs numeric events
- Event serialization requirements

### 4.4 Data Layer Specification
- Page-level data layer structure
- Event-level data layer structure
- Naming conventions

## 5. PAGE/SCREEN TRACKING MATRIX
Create a table showing what variables are captured on each page type

## 6. IMPLEMENTATION APPROACH
- Recommended implementation phases
- Prerequisites and dependencies
- Testing strategy
- Rollout plan

## 7. REPORTING REQUIREMENTS
- Key reports needed
- Dashboard requirements
- Segmentation strategy

Make this detailed, specific to e-commerce, and follow Adobe Analytics best practices.
Use realistic variable allocations (e.g., eVar1, eVar2, prop1, event1, etc.).
"""

VALIDATION_PROMPT = """Review the generated BRD/SDR document for quality and completeness.

ORIGINAL DISCOVERY:
{discovery_content}

GENERATED BRD/SDR:
{brd_sdr}

Check the following:

1. Completeness
   - Are all discovery requirements addressed?
   - Are there any gaps in the tracking specification?
   - Are all critical user journeys covered?

2. Technical Accuracy
   - Are variable allocations appropriate?
   - Is the data layer design sound?
   - Are event definitions clear?

3. Best Practices
   - Does it follow Adobe Analytics best practices?
   - Is it scalable for future needs?
   - Are naming conventions consistent?

4. Clarity
   - Is it clear enough for developers to implement?
   - Are definitions unambiguous?
   - Are examples provided where needed?

Provide:
- A quality score (1-10)
- List of issues found (if any)
- Suggestions for improvement
- A revised version if score < 8
"""
