# n8n Workflow v0.7 Implementation Complete

**Date**: February 4, 2025  
**Status**: ✅ Implementation Complete - Ready for Testing

## Overview

Successfully upgraded n8n workflow from 2-output to 3-output system for TSD Agent:
1. **JavaScript** (`adobeDataLayer_{timestamp}.js`) - Adobe Data Layer implementation
2. **Markdown** (`TSD_{timestamp}.md`) - Technical Solution Design documentation
3. **Launch Payload** (`LaunchPayload_{timestamp}.json`) - Adobe Launch API-compatible JSON

## Changes Made

### 1. TSD Agent Node (ID: 68a24e26-b0c1-4159-8dfa-6735c362c7ba)

#### User Prompt Updated
- Changed from **TWO outputs** to **THREE outputs**
- Added `launchPayload` specification with Adobe Launch API structure
- Improved JavaScript output description to use page-specific functions (trackHomePage, trackPDPPage, etc.)
- Enhanced Markdown output description to enforce strict 5-part structure per section

**Key Changes:**
```
Generate THREE outputs as a JSON object:

1. "javascript": Adobe Data Layer implementation
   - Page-specific functions (trackHomePage, trackPDPPage, etc.)
   - HTML click event listeners
   
2. "markdown": Technical Solution Design
   - Strict 5-part structure for each section
   - Variable mapping tables
   
3. "launchPayload": Adobe Launch API-compatible JSON
   - Rules for all tracking events
   - Data element references (%dl.{path}%)
   - XDM mapping configuration
```

#### System Prompt Enhanced
- Added **Launch Payload Generation Rules** section (70+ lines)
- Specified Adobe Launch API JSON structure with:
  - `property_info` (name, platform)
  - `extensions` (adobe-alchemy with datastream ID)
  - `rules` (Page View, Click, Commerce events)
- Defined data element reference format: `%dl.{path}%`
- Provided XDM mapping examples for rule actions
- Updated Critical Output Rules to require 3-output format

**New Launch Payload Rules:**
1. **Rule Generation**: Create one rule per event type (Page View, Click, Commerce)
2. **Data Element References**: Use `%dl.event%`, `%dl.web.webPageDetails.name%`, etc.
3. **XDM Mapping**: Map Data Layer → XDM in rule action settings
4. **Event Types**: Use Adobe-standard types (web.webpagedetails.pageViews, commerce.purchases, etc.)
5. **Conditions**: Add page-specific conditions (URL contains, Page type equals)

### 2. Parse TSD Output Node (ID: 57e5232a-0c32-47c3-a84f-2545f3d90869)

**Updated to handle 3 files:**
- Added `launchPayload` file parsing and validation
- Changed input structure to: `{ clientName, output: { javascript, markdown, launchPayload } }`
- Added error check for missing `launchPayload` field
- Generate `launchFilename` with timestamp: `{clientName}_LaunchPayload_{timestamp}.json`
- Stringify Launch Payload JSON if it's an object
- Added `launchRulesCount` to stats object

**New Output Structure:**
```javascript
{
  clientName: "ClientName",
  files: {
    javascript: { filename, content, size, type: 'application/javascript' },
    markdown: { filename, content, size, type: 'text/markdown' },
    launchPayload: { filename, content, size, type: 'application/json' }
  },
  stats: {
    jsLines: number,
    mdLines: number,
    launchRulesCount: number,
    generatedAt: ISO timestamp
  }
}
```

### 3. Split Files for Upload Node (ID: 08b7cb22-d432-4d6a-aeb7-7aecd3f32131)

**Updated to return 3 items:**
- Added Launch Payload file conversion to base64
- Set MIME type to `application/json; charset=utf-8` for Launch Payload
- Return array of 3 binary items (JavaScript, Markdown, Launch Payload)
- Each item includes: `{ json: {...}, binary: { data: {...} } }`

**Binary Data Format:**
```javascript
{
  json: {
    clientName: "ClientName",
    filename: "{ClientName}_LaunchPayload_{timestamp}.json",
    fileType: "Launch Payload",
    folderId: "Google Drive folder ID",
    stats: {...}
  },
  binary: {
    data: {
      data: "base64 encoded content",
      mimeType: "application/json; charset=utf-8",
      fileName: "{ClientName}_LaunchPayload_{timestamp}.json"
    }
  }
}
```

### 4. Collect Upload Results Node (ID: efab5523-1233-4f2e-ba46-5e75e0211839)

**Enhanced to categorize 3 files:**
- Added `fileTypes` object to categorize uploaded files:
  - `javascript`: File with `adobeDataLayer` in name
  - `markdown`: File with `TSD` and `.md` extension
  - `launchPayload`: File with `LaunchPayload` in name
- Updated console log message to reflect 3 files
- Added descriptive success message: "Successfully uploaded 3 files (JavaScript, Markdown, Launch Payload)"

**Output Structure:**
```javascript
{
  success: true,
  clientName: "ClientName",
  googleDrive: {
    folder: "TSD/ClientName",
    files: [ /* all 3 files */ ],
    fileTypes: {
      javascript: { fileId, fileName, webViewLink, ... },
      markdown: { ... },
      launchPayload: { ... }
    }
  },
  totalFiles: 3,
  message: "Successfully uploaded 3 files..."
}
```

## XDM Mapping Rules Integration

System prompt now includes **xdm_mapping.csv** rules:

### Data Layer to eVar Mapping
- `event` → eVar10 (event name)
- `pageType` → eVar9 (page type)
- `user.loginStatus` → eVar11 (login status)
- `user.profile.customerId` → eVar12 (customer ID)
- `user.profile.memberTier` → eVar13 (member tier)

### Merchandising eVars (Product Context Only)
- `product.id` OR `productListItems[].SKU` → eVar20 (product ID)
- `product.name` OR `productListItems[].name` → eVar21 (product name)
- `product.category` OR `productListItems[].category` → eVar22 (category)
- `product.brand` OR `productListItems[].brand` → eVar23 (brand)

### HTML Attribute to XDM Mapping (for Click Events)
- `data-aa-event` → eVar10
- `data-aa-product-id` → eVar20 + xdm.productListItems[].SKU
- `data-aa-product-name` → eVar21 + xdm.productListItems[].name
- `data-aa-category` → eVar22
- `data-aa-brand` → eVar23
- `data-aa-price` → xdm.productListItems[].priceTotal
- `data-aa-currency` → xdm.commerce.order.currencyCode

### Data Layer to XDM Direct Mapping
- `web.webPageDetails.*` → xdm.web.webPageDetails.* (direct)
- `product.id` → xdm.productListItems[].SKU
- `commerce.order.*` → xdm.commerce.order.* (direct)
- `commerce.purchases.value` → xdm.commerce.purchases.value

## Expected Output Format

### JavaScript Output (`adobeDataLayer_{timestamp}.js`)
```javascript
// Page-specific tracking functions
function trackHomePage() {
  window.adobeDataLayer = window.adobeDataLayer || [];
  window.adobeDataLayer.push({
    event: "pageLoaded",
    pageType: "home",
    web: {
      webPageDetails: {
        name: "<Page Name>",
        siteSection: "<Section>",
        URL: "<URL>"
      }
    },
    user: {
      loginStatus: "<logged in|logged out>",
      profile: {
        customerId: "<Customer ID>",
        memberTier: "<Tier>"
      }
    }
  });
}

function trackPDPPage() {
  window.adobeDataLayer.push({
    event: "productViewed",
    pageType: "product detail",
    product: {
      id: "<Product ID>",
      name: "<Product Name>",
      category: "<Category>",
      brand: "<Brand>",
      price: <Price>,
      currency: "<Currency>"
    }
  });
}

// HTML Click Event Listeners
document.addEventListener('click', function(e) {
  if (e.target.hasAttribute('data-aa-event')) {
    const eventName = e.target.getAttribute('data-aa-event');
    // Push click event to data layer
  }
});
```

### Markdown Output (`TSD_{timestamp}.md`)
```markdown
# Technical Solution Design: ClientName

## 1. Overview
- Total eVars: 15
- Total Props: 5
- Total Events: 10
- Merchandising eVars: eVar20, eVar21, eVar22, eVar23

## 2. Variable Mapping Summary

### eVars
| eVar | Variable Name | Data Layer Path | Merchandising | Event Context |
|------|---------------|-----------------|---------------|---------------|
| eVar9 | Page Type | pageType | n/a | All Pages |
| eVar10 | Event Name | event | n/a | All Events |
| eVar20 | Product ID | product.id OR productListItems[].SKU | Product Syntax | Product Views, Cart, Purchase |

## 6. Solution Component

### 6.1 Global

#### 6.1.1 Page

**Analytics Variables In this section:**
| Analytics Variable | Used For | XDM Data | Source |
|--------------------|----------|----------|--------|
| eVar9 | Page Type | pageType | DataLayer |
| eVar10 | Event Name | event | DataLayer |

**Deployment Instruction:**
| Data Object | Note |
|-------------|------|
| event | pageLoaded |
| web.webPageDetails.name | Homepage |

**상세 Script (DataLayer Push):**
```javascript
function trackPageLoad() {
  window.adobeDataLayer.push({
    event: "pageLoaded",
    pageType: "home",
    web: { webPageDetails: { name: "<Page Name>" } }
  });
}
```

**Configuring Tracking:**
| Data Element | Extension | Data Element Type | Path/Parameter | Adobe Launch Rules | Comments |
|--------------|-----------|-------------------|----------------|-------------------|----------|
| dl.event | Core | Data Layer | event | Page Load | Event name from data layer |

**Create Adobe Launch Rules:**
| Rule Name | Events | Condition | Action | Special Instruction |
|-----------|--------|-----------|--------|---------------------|
| Page Load | Custom Event: pageLoaded | None | Send Event (AEP Web SDK) | Map eVar9, eVar10 |
```

### Launch Payload Output (`LaunchPayload_{timestamp}.json`)
```json
{
  "property_info": {
    "name": "ClientName - Adobe Analytics Implementation",
    "platform": "web"
  },
  "extensions": [
    {
      "id": "adobe-alchemy",
      "name": "Adobe Experience Platform Web SDK",
      "settings": {
        "edgeConfigId": "<DATASTREAM_ID>"
      }
    }
  ],
  "rules": [
    {
      "name": "Page Load - Home",
      "events": [
        {
          "modulePath": "adobe-alchemy/src/lib/events/sendEvent.js",
          "settings": {
            "type": "web.webpagedetails.pageViews"
          }
        }
      ],
      "conditions": [],
      "actions": [
        {
          "modulePath": "adobe-alchemy/src/lib/actions/sendEvent.js",
          "settings": {
            "type": "web.webpagedetails.pageViews",
            "xdm": {
              "web": {
                "webPageDetails": {
                  "name": "%dl.web.webPageDetails.name%"
                }
              },
              "_experience": {
                "analytics": {
                  "customDimensions": {
                    "eVars": {
                      "eVar9": "%dl.pageType%",
                      "eVar10": "%dl.event%"
                    }
                  }
                }
              }
            }
          }
        }
      ]
    },
    {
      "name": "Product View",
      "events": [
        {
          "modulePath": "adobe-alchemy/src/lib/events/sendEvent.js",
          "settings": {
            "type": "commerce.productViews"
          }
        }
      ],
      "conditions": [
        {
          "modulePath": "core/src/lib/conditions/customCode.js",
          "settings": {
            "source": "return %dl.event% === 'productViewed';"
          }
        }
      ],
      "actions": [
        {
          "modulePath": "adobe-alchemy/src/lib/actions/sendEvent.js",
          "settings": {
            "type": "commerce.productViews",
            "xdm": {
              "productListItems": [
                {
                  "SKU": "%dl.product.id%",
                  "name": "%dl.product.name%",
                  "productCategories": [
                    {
                      "categoryID": "%dl.product.category%"
                    }
                  ],
                  "priceTotal": "%dl.product.price%"
                }
              ],
              "_experience": {
                "analytics": {
                  "customDimensions": {
                    "eVars": {
                      "eVar20": "%dl.product.id%",
                      "eVar21": "%dl.product.name%",
                      "eVar22": "%dl.product.category%",
                      "eVar23": "%dl.product.brand%"
                    }
                  }
                }
              }
            }
          }
        }
      ]
    }
  ]
}
```

## File Naming Convention

All files use timestamp format: `YYYYMMDD-HHMMSS` (ISO format with hyphens replacing colons)

- **JavaScript**: `{ClientName}_adobeDataLayer_{timestamp}.js`
- **Markdown**: `{ClientName}_TSD_{timestamp}.md`
- **Launch Payload**: `{ClientName}_LaunchPayload_{timestamp}.json`

Example:
- `Acme_adobeDataLayer_2025-02-04T14-30-00.js`
- `Acme_TSD_2025-02-04T14-30-00.md`
- `Acme_LaunchPayload_2025-02-04T14-30-00.json`

## Google Drive Upload

Files are uploaded to: `TSD/{ClientName}/`

**Upload Response:**
```json
{
  "success": true,
  "clientName": "ClientName",
  "googleDrive": {
    "folder": "TSD/ClientName",
    "files": [
      {
        "fileId": "1abc...",
        "fileName": "ClientName_adobeDataLayer_2025-02-04T14-30-00.js",
        "mimeType": "text/plain",
        "webViewLink": "https://drive.google.com/file/d/1abc.../view",
        "webContentLink": "https://drive.google.com/uc?id=1abc...&export=download",
        "createdTime": "2025-02-04T14:30:00.000Z"
      },
      { /* Markdown file */ },
      { /* Launch Payload file */ }
    ],
    "fileTypes": {
      "javascript": { /* JavaScript file object */ },
      "markdown": { /* Markdown file object */ },
      "launchPayload": { /* Launch Payload file object */ }
    }
  },
  "totalFiles": 3,
  "message": "Successfully uploaded 3 files (JavaScript, Markdown, Launch Payload) to Google Drive"
}
```

## Testing Checklist

- [ ] Import updated workflow JSON to n8n
- [ ] Test with sample BRD file (e-commerce scenario with product eVars)
- [ ] Verify TSD Agent generates 3 outputs (javascript, markdown, launchPayload)
- [ ] Check JavaScript output has page-specific functions (trackHomePage, trackPDPPage, etc.)
- [ ] Verify Markdown has strict 5-part structure for each section (6.1.1, 6.1.2, etc.)
- [ ] Validate Launch Payload has 5-15 rules with proper XDM mapping
- [ ] Confirm 3 files uploaded to Google Drive with correct naming
- [ ] Check console logs show "Total files uploaded: 3"
- [ ] Verify fileTypes object categorizes files correctly
- [ ] Test Launch Payload JSON is valid and importable to Adobe Launch

## Expected Stats Output

```
=== Parse TSD Output (3 Files) ===
Client: ClientName
JavaScript size: 5000-15000 characters
Markdown size: 10000-30000 characters
Launch Payload size: 3000-10000 characters

=== TSD Files Uploaded to Google Drive ===
Client: ClientName
Total files uploaded: 3
- ClientName_adobeDataLayer_2025-02-04T14-30-00.js
  ID: 1abc...
  Link: https://drive.google.com/file/d/1abc.../view
- ClientName_TSD_2025-02-04T14-30-00.md
  ID: 1def...
  Link: https://drive.google.com/file/d/1def.../view
- ClientName_LaunchPayload_2025-02-04T14-30-00.json
  ID: 1ghi...
  Link: https://drive.google.com/file/d/1ghi.../view
```

## JavaScript Output Structure Improvements

### Page-Specific Functions
Based on [AA Tagging AI-dataLayer.js](../base-docs/3_tsd/base_js_json/AA%20Tagging%20AI-dataLayer.js):

- `trackHomePage()` - Homepage tracking
- `trackPDPPage()` - Product Detail Page
- `trackPLPPage()` - Product Listing Page
- `trackCartPage()` - Shopping Cart
- `trackCheckoutPage()` - Checkout pages
- `trackOrderConfirmationPage()` - Order confirmation
- `trackGenericPage()` - Generic page template

### HTML Click Tracking
```javascript
// Add event listeners for click tracking
document.addEventListener('click', function(e) {
  const clickableElement = e.target.closest('[data-aa-event]');
  
  if (clickableElement) {
    const eventName = clickableElement.getAttribute('data-aa-event');
    const productId = clickableElement.getAttribute('data-aa-product-id');
    const productName = clickableElement.getAttribute('data-aa-product-name');
    
    window.adobeDataLayer.push({
      event: eventName,
      product: {
        id: productId,
        name: productName,
        // ... other attributes
      }
    });
  }
});
```

## Launch Payload Structure Details

### Property Info
```json
{
  "property_info": {
    "name": "{ClientName} - Adobe Analytics Implementation",
    "platform": "web"
  }
}
```

### Extensions
```json
{
  "extensions": [
    {
      "id": "adobe-alchemy",
      "name": "Adobe Experience Platform Web SDK",
      "settings": {
        "edgeConfigId": "<DATASTREAM_ID>",
        "edgeDomain": "edge.adobedc.net"
      }
    }
  ]
}
```

### Rules Structure
Each rule has:
1. **name**: Descriptive name (e.g., "Page Load - Home", "Product View", "Add to Cart")
2. **events**: Array of event triggers (Custom Event from Data Layer)
3. **conditions**: Optional conditions (page URL, event name, etc.)
4. **actions**: Array of actions (Send Event with XDM mapping)

## Validation Criteria

### JavaScript File
- ✅ Contains 6+ page-specific functions (trackHomePage, trackPDPPage, etc.)
- ✅ Each function pushes complete data layer object
- ✅ Includes HTML click event listener
- ✅ All placeholders in `<angle brackets>`
- ✅ Size: 5,000-15,000 characters

### Markdown File
- ✅ Follows strict TSD structure (sections 1, 2, 6)
- ✅ Each subsection (6.1.1, 6.1.2, etc.) has ALL 5 parts:
  - Analytics Variables In this section (table)
  - Deployment Instruction (table)
  - 상세 Script (DataLayer Push) (code)
  - Configuring Tracking (table)
  - Create Adobe Launch Rules (table)
- ✅ Variable mapping tables complete
- ✅ Size: 10,000-30,000 characters

### Launch Payload File
- ✅ Valid JSON structure (property_info, extensions, rules)
- ✅ Contains 5-15 rules based on SDR events
- ✅ Each rule has proper XDM mapping
- ✅ Data element references use `%dl.{path}%` format
- ✅ Event types match Adobe standards
- ✅ Size: 3,000-10,000 characters

## Next Steps

1. **Import Workflow**: Import updated JSON file to n8n instance
2. **Test with Sample BRD**: Use e-commerce BRD with product merchandising eVars
3. **Validate Outputs**: Check all 3 files meet validation criteria
4. **Review Launch Payload**: Verify rules are importable to Adobe Launch
5. **Document Issues**: Report any LLM generation issues for prompt tuning

## Known Limitations

1. **Launch Payload Validation**: Need to test actual import to Adobe Launch API
2. **Data Element References**: May need adjustment based on Adobe Launch version
3. **XDM Mapping Completeness**: Some edge cases may require manual adjustment
4. **Rule Complexity**: Very complex SDRs (30+ eVars) may need rule splitting

## Reference Files

- [xdm_mapping.csv](../base-docs/3_tsd/base_js_json/xdm_mapping.csv) - XDM mapping rules
- [AA Tagging AI-dataLayer.js](../base-docs/3_tsd/base_js_json/AA%20Tagging%20AI-dataLayer.js) - JavaScript template
- [tagging_ai_result_for_alcreation_beautified.json](tagging_ai_result_for_alcreation_beautified.json) - Launch Payload template
- [BRD to SDR with TSD - v0.7.json](BRD%20to%20SDR%20with%20TSD%20-%20v0.7.json) - Updated workflow file

---

**Implementation Status**: ✅ Complete  
**Ready for Testing**: Yes  
**Breaking Changes**: Yes (output structure changed from 2 to 3 files)  
**Backward Compatibility**: No (v0.6 workflows will not work with v0.7 prompts)
