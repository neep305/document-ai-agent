# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tagging AI** is an AI-powered documentation workflow system for Adobe Analytics implementation projects. The goal is to automate document generation from initial requirements through to QA reporting, reducing manual documentation effort in Adobe Analytics tagging projects.

## Document Workflow Stages

The project follows a structured 6-stage workflow, with each stage represented by a numbered directory in `base-docs/`:

1. **Discovery** (`1_discovery/`) - Initial project discovery and requirements gathering
   - Contains: Project Discovery Templates (Excel format)

2. **BRD/SDR** (`2_brd_sdr/`) - Business Requirements Document & Solution Design Reference
   - Contains: Combined BRD/SDR documents (Excel format)
   - These are manually created based on discovery phase

3. **TSD** (`3_tsd/`) - Technical Specification Document
   - Contains: Technical implementation specs for different platforms (Web SDK, Mobile Edge SDK)
   - AI generates these from the BRD/SDR using inference
   - Format: Word documents (.docx)

4. **Validation** (`4_validation/`) - Tag QA and validation
   - Contains: Validation documents for completed tag implementations
   - AI assists with QA tasks on user/consultant-created tags
   - Format: Excel spreadsheets

5. **Go Live** (`5_go_live/`) - Go-live checklists
   - Contains: Platform-specific go-live checklists (Web SDK, Mobile Edge SDK)
   - AI generates QA reports based on validation results
   - Format: Excel spreadsheets

## Document Types and Platforms

The codebase handles different Adobe implementation platforms:

- **Web SDK** - Adobe Experience Platform Web SDK implementations
- **Mobile Edge SDK** - Android and iOS mobile implementations using Adobe Edge Network

Document templates are platform-specific and use different formats (Excel .xlsx, Word .docx) depending on the workflow stage.

## Key AI Workflow Pattern

The AI system follows this pattern:
1. Takes structured input documents (Discovery → BRD/SDR)
2. Uses inference to generate downstream technical documents (TSD)
3. Assists with QA validation of implemented tags
4. Generates final QA reports for go-live

When working with this codebase, understand that document generation should maintain consistency with Adobe Analytics best practices and platform-specific implementation requirements.

## File Organization

- `base-docs/` - Root directory containing all template documents organized by workflow stage
- `base-docs/PROJECT.md` - Korean-language project description and workflow overview
- Each numbered subdirectory (1-5) contains stage-specific document templates

## Language Note

Project documentation (PROJECT.md) is in Korean, but technical documents are in English. When generating new documents, follow the language convention of existing templates in that category.
