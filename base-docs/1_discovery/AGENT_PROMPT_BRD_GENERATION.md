# Agent Prompt: Generate BRD Framework from Discovery Questionnaire

## Overview
This prompt guides an AI agent to create a Business Requirements Document (BRD) framework from a Discovery Questionnaire. The BRD follows a hierarchical structure used in Adobe Analytics implementation projects.

## Task Description
Generate a structured BRD Excel file that translates discovery questionnaire findings into a hierarchical business framework with goals, strategies, initiatives, tactics, KPIs, and business capabilities.

## Input Files Required
1. **Discovery Questionnaire**: Excel file containing client responses
   - Example: `Discovery Q to BRD.xlsx`
   - Key sheet: `Kickoff Questionnaire`
   - Contains questions and client feedback across categories:
     - Site Architecture
     - Performance
     - Acquisition/Retention
     - Governance
     - Privacy
     - QA
     - Report Suite Architecture

2. **Reference Template**: Excel file with hierarchy structure
   - Example: `Discovery Q to BRD.xlsx` → `Manufacturing` sheet
   - Shows the 6-level hierarchy structure to follow

## Output Specifications

### File Format
- **File Type**: Excel (.xlsx)
- **Naming Convention**: `{CLIENT_NAME}_BRD_Framework.xlsx`
- **Sheet Name**: `{CLIENT_NAME} BRD` or similar

### Hierarchy Structure (6 Levels)

```
Business Goal
  └─ Strategy
      └─ Initiative
          └─ Tactics
              ├─ KPI
              └─ Business Capability (multiple per tactic)
```

### Column Structure
| Column | Name | Description | Merge Strategy |
|--------|------|-------------|----------------|
| A | Business Goal | Top-level business objective | Merge vertically across all related rows |
| B | Strategy | High-level approach to achieve goal | Merge vertically across all related rows |
| C | Initiative | Specific program or effort | Merge vertically across all related rows |
| D | Tactics | Specific actions or methods | Merge vertically across all related rows |
| E | KPI | Key Performance Indicators | No merge - individual cells |
| F | Business Capability | Required capabilities or actions | No merge - individual cells |

### Styling Requirements

#### Header Row (Row 1)
- **Font**: Bold, White (FFFFFF), Size 11
- **Background**: Blue (4472C4)
- **Alignment**: Center horizontal and vertical
- **Border**: Thin border all sides
- **Text Wrap**: Enabled

#### Column Widths
- Column A (Business Goal): 20
- Column B (Strategy): 25
- Column C (Initiative): 30
- Column D (Tactics): 35
- Column E (KPI): 30
- Column F (Business Capability): 45

#### Row Heights
- All data rows: 25

#### Data Cell Styling

**Column A (Business Goal)**
- Font: Bold, Size 12, Color: Dark Blue (1F4E78)
- Background: Light Blue (D9E2F3)
- Alignment: Left horizontal, Center vertical
- Text Wrap: Enabled

**Column B (Strategy)**
- Font: Bold, Size 11, Color: Medium Blue (2E5C8A)
- Background: Lighter Blue (E7F0F7)
- Alignment: Left horizontal, Center vertical
- Text Wrap: Enabled

**Column C (Initiative)**
- Font: Bold, Size 10, Color: Steel Blue (3D5A80)
- Background: Lightest Blue (F2F6F9)
- Alignment: Left horizontal, Center vertical
- Text Wrap: Enabled

**Column D (Tactics)**
- Font: Regular, Size 10, Color: Black (000000)
- Background: None
- Alignment: Left horizontal, Top vertical
- Text Wrap: Enabled

**Column E (KPI)**
- Font: Regular, Size 10, Color: Black (000000)
- Background: None
- Alignment: Left horizontal, Top vertical
- Text Wrap: Enabled

**Column F (Business Capability)**
- Font: Regular, Size 10, Color: Black (000000)
- Background: None
- Alignment: Left horizontal, Top vertical
- Text Wrap: Enabled

#### Borders
- All cells: Thin border on all sides

#### Additional Formatting
- Freeze Panes: Row 2 (header row always visible)

## Content Generation Guidelines

### 1. Analyze Discovery Questionnaire
Read and understand the client's business context from their responses:
- Business model and revenue generation
- Target audience and competitors
- Technical architecture (platforms, frameworks, hosting)
- Marketing channels and performance
- Key challenges and pain points
- Business objectives
- Organizational structure
- Compliance requirements
- QA and release processes
- Analytics maturity and data integration needs

### 2. Define Business Goals
Based on discovery findings, create 3-7 top-level business goals. Common goals for different business types:

**B2C E-commerce / Retail:**
- Grow Revenue
- Increase Customer Lifetime Value
- Optimize Multi-Channel Performance
- Improve Data-Driven Decision Making
- Ensure Compliance and Governance

**B2B / Enterprise:**
- Grow Revenue
- Increase Account Value
- Improve Lead Quality and Conversion
- Enhance Customer Engagement
- Enable Data-Driven Sales

**Media / Content:**
- Increase Audience Engagement
- Optimize Content Performance
- Grow Subscription Revenue
- Improve Advertising Revenue
- Enhance Personalization

### 3. Map Strategies to Goals
For each business goal, define 1-3 strategies:
- Should directly support the goal
- Should be actionable and measurable
- Should align with client's stated objectives and challenges

### 4. Define Initiatives under Strategies
For each strategy, create 1-5 initiatives:
- Specific programs or efforts
- Should address challenges mentioned in discovery
- Should leverage client's existing capabilities
- Should consider technical constraints

### 5. Specify Tactics for Each Initiative
For each initiative, define 1-5 tactics:
- Concrete, actionable methods
- Should be implementable given client's tech stack
- Should align with client's priorities
- Should consider organizational readiness

### 6. Assign KPIs to Tactics
For each tactic, specify measurable KPIs:
- Should be trackable with Adobe Analytics
- Should align with client's current measurement approach
- Should be specific and quantifiable
- Can list multiple KPIs separated by commas

### 7. List Business Capabilities per Tactic
For each tactic, list 2-5 business capabilities (one per row):
- Specific actions or requirements needed
- Technical capabilities (tracking, integration, analysis)
- Process capabilities (testing, governance, optimization)
- Organizational capabilities (training, roles, workflows)

### 8. Handle Unknown Information
- If specific information is missing from discovery questionnaire, leave cells blank
- Do not invent or assume critical business information
- Use industry best practices for standard capabilities
- Mark uncertain areas for client validation

## Implementation Steps

### Step 1: Install Required Libraries
```python
pip install openpyxl pandas
```

### Step 2: Read Discovery Questionnaire
```python
import pandas as pd
import openpyxl

file_path = 'path/to/Discovery Q to BRD.xlsx'
df = pd.read_excel(file_path, sheet_name='Kickoff Questionnaire', skiprows=5)
```

### Step 3: Analyze Client Context
Parse questionnaire responses by category and extract:
- Company name
- Business model
- Technical architecture
- Key challenges
- Business objectives
- Marketing channels
- Organizational structure

### Step 4: Create BRD Data Structure
```python
brd_data = [
    ["Business Goal 1", "Strategy 1", "Initiative 1", "Tactic 1", "KPI 1", "Capability 1"],
    ["", "", "", "", "", "Capability 2"],
    ["", "", "", "", "", "Capability 3"],
    ["", "", "", "Tactic 2", "KPI 2", "Capability 4"],
    # ... more rows
]
```

### Step 5: Create Excel Workbook
```python
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Client BRD"

# Create header row with styling
headers = ["Business Goal", "Strategy", "Initiative", "Tactics", "KPI", "Business Capability"]
for col_num, header in enumerate(headers, 1):
    cell = ws.cell(row=1, column=col_num)
    cell.value = header
    # Apply header styling...

# Write data
for row_num, row_data in enumerate(brd_data, 2):
    for col_num, value in enumerate(row_data, 1):
        cell = ws.cell(row=row_num, column=col_num)
        cell.value = value
        # Apply styling...
```

### Step 6: Apply Cell Merging
```python
# Find ranges to merge for each hierarchical column
def find_merge_ranges(data, column_index):
    ranges = []
    current_value = None
    start_row = None

    for i, row in enumerate(data, start=2):
        value = row[column_index]

        if value and value.strip():
            if current_value != value:
                if start_row and current_value:
                    ranges.append((start_row, i-1, current_value))
                current_value = value
                start_row = i

    if start_row and current_value:
        ranges.append((start_row, len(data)+1, current_value))

    return ranges

# Apply merges for columns A, B, C, D
for col_letter, col_index in [('A', 0), ('B', 1), ('C', 2), ('D', 3)]:
    ranges = find_merge_ranges(brd_data, col_index)
    for start_row, end_row, value in ranges:
        if start_row < end_row:
            ws.merge_cells(f'{col_letter}{start_row}:{col_letter}{end_row}')
            # Apply styling to merged cell...
```

### Step 7: Save Workbook
```python
output_path = f'path/to/{client_name}_BRD_Framework.xlsx'
wb.save(output_path)
```

## Example: B2C E-commerce BRD Structure

```
Business Goal: Grow Revenue
  Strategy: Acquire new customers
    Initiative: Increase qualified traffic
      Tactic: Increase paid media traffic
        KPI: Traffic by paid media channels
        Capability: Create relevant paid media assets
        Capability: Target high-value audiences
        Capability: Optimize channel placement
      Tactic: Improve SEO traffic
        KPI: SEO traffic
        Capability: Enhance content tagging
        Capability: Improve site structure
    Initiative: Improve new user conversion
      Tactic: Increase registration conversion rate
        KPI: New user registration rate
        Capability: Simplify registration flow
        Capability: Offer registration incentives
```

## Quality Checklist

Before finalizing the BRD, verify:

- [ ] All hierarchy levels are properly structured (6 levels)
- [ ] Cell merging is applied correctly to columns A-D
- [ ] Styling matches specifications (colors, fonts, borders)
- [ ] Column widths and row heights are set appropriately
- [ ] Header row is frozen
- [ ] Content aligns with client's discovery responses
- [ ] Business goals address client's stated objectives
- [ ] Tactics are feasible given client's tech stack
- [ ] KPIs are measurable with Adobe Analytics
- [ ] Business capabilities are specific and actionable
- [ ] No placeholder text remains (or clearly marked as TBD)
- [ ] File naming follows convention
- [ ] Excel file opens without errors

## Common Business Goals by Industry

### E-commerce / Retail
1. Grow Revenue (acquisition, conversion, AOV)
2. Increase Customer Lifetime Value (retention, repeat purchase)
3. Optimize Multi-Channel Performance (online, mobile, app, in-store)
4. Improve Merchandising Effectiveness
5. Enhance Customer Experience

### B2B / SaaS
1. Generate Qualified Leads
2. Improve Lead-to-Customer Conversion
3. Increase Product Adoption
4. Reduce Churn
5. Enable Account-Based Marketing

### Media / Publishing
1. Grow Audience Reach
2. Increase Content Engagement
3. Optimize Subscription Conversion
4. Improve Ad Revenue
5. Enhance Personalization

### Financial Services
1. Increase Product Adoption
2. Improve Digital Self-Service
3. Enhance Customer Retention
4. Optimize Cross-Sell Opportunities
5. Ensure Regulatory Compliance

### Travel / Hospitality
1. Increase Direct Bookings
2. Reduce Booking Abandonment
3. Optimize Multi-Device Journey
4. Improve Loyalty Program Engagement
5. Enhance Personalization

## Troubleshooting

### Issue: Cell merging not working correctly
**Solution**: Ensure empty string values ("") are used for continuation rows, not None/null values

### Issue: Styling not applied
**Solution**: Check that openpyxl.styles imports are correct and color codes use proper hex format

### Issue: Excel file corruption
**Solution**: Validate that merge ranges don't overlap and all cell references are valid

### Issue: Content doesn't match client needs
**Solution**: Re-read discovery questionnaire focusing on client's stated challenges and objectives

### Issue: Too generic / not specific enough
**Solution**: Incorporate client-specific details like:
- Actual platform names (e.g., "Next.js SPA" not just "website")
- Specific channels (e.g., "TV homeshopping" not just "offline")
- Named tools (e.g., "Amplitude, Braze" not just "third-party tools")
- Real challenges (e.g., "new user registration conversion" not just "conversion")

## Version History
- v1.0 (2025-12-17): Initial version based on GSSHOP BRD generation project

## Notes
- This framework is designed for Adobe Analytics implementation projects
- The hierarchy structure can be adapted for other analytics platforms
- Content should always be customized based on specific client needs
- Empty cells are acceptable for unknown/TBD items
