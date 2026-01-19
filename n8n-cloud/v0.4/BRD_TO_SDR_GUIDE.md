# BRD_TO_SDR Guide

## Background : 

Adobe Analytics Business Requirement Document (BRD) is created after discovery/interview session with a client and it covers  

- In which digital property (web or app) and parts (section/pages) of the property they want to implement AA 
- What kind of user behavior they want to track/measure in the properties 
- What are the key interaction points or conversion events 
- What and how they want to view the tracked data in end-report (Adobe Analytics Workspace) 

And based on this BRD, Solution Design Reference (SDR) need to be developed 

## The Adobe Analytics SDR should contain  

- Variable Design : Define all eVars, props, events, and their purpose and specify data types, expiration settings, and allocation rules. 
- Tracking requirement mapping with variables : each BRD requirement to Adobe Analytics variables (eVars, props, events). 
- Technical Notes & Dependencies : Include any prerequisites, dependencies, or integration points (e.g., Launch tags, custom scripts). 


## When it comes to Variable design, below points need to be considered and accommodated. 

- Correct Mapping to Business Requirements 

Ensure every variable (eVar, prop, event) directly maps to a BRD requirement. 

Avoid creating variables that do not serve a clear business purpose. 

Validate that the variable supports the intended reporting view in Adobe Analytics Workspace. 

- Choosing Between eVars, Props, and Events 
    - eVars: For persistent values (e.g., campaign ID, user type) that need attribution across sessions or conversions. 
    - Props: For page-level or hit-level data (e.g., page name, device type). 
    - Events: For actions or conversions (e.g., form submission, purchase). 

Watch out for misuse (e.g., using props for attribution or eVars for non-persistent data). 

- Naming Conventions 
Use clear, descriptive names for variables (e.g., eVar10 - Product Category) that business users can understand intuitively 
Maintain consistency across SDR 

- Data Types & Formatting 

Ensure the expected data format matches the BRD (e.g., string, numeric, currency). 

Watch out for inconsistent casing or delimiters (e.g., ProductCategory vs. product_category). 

- Avoid Overlapping or Redundant Variables 

Check if multiple variables are capturing the same data unnecessarily. 

Consolidate where possible to reduce complexity and cost. 


- Allocate Variables in efficiently considering limits 

Based on client's AA SKU, entitled number of variables are different (AA Prime - 250 eVars, 75 props, 1000 event). 

Allocate variables in Mutually Exclusive and Collectively Exhaustive (MECE) manner for both sustainability & scalability 

- Reporting Alignment 

Validate that variable design supports segments, breakdowns, and calculated metrics as per BRD. 

Example: If BRD requires “Conversion by Campaign,” ensure campaign eVar persists until conversion. 


SDR should be generated in EXCEL format with tabs such as 

- eVars : contains columns of Requirement ID (to trace back to which business requirement it respond to), Variable Number, Variable Name, Variable Description, Value Format(text/string/number), Example Value, eVar Allocation (Most Recent/Original Value/Linear), eVar Expiration (hit/visit/visitor/event/custom time period) 

- Prop : contains columns of Requirement ID (to trace back to which business requirement it respond to), Variable Number, Variable Name, Variable Description, Value Format(text/string/number), Example Value 

- Custom events (metrics) : contains columns of Requirement ID (to trace back to which business requirement it respond to), Event Number, Event Name, Event Description, Event Type (counter/numeric/currency) 

In SDR, must allocate variable for below reports regardless of redundancy  

- eVar : Pagename, Site Section, ECID 
- Prop : Pagename, Site Section, ECID 
- Event : Custom Page View 

 