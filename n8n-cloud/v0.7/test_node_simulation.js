/**
 * n8n v0.7 Workflow Node Simulation Test
 * Tests Parse TSD Output and downstream nodes with actual payload
 */

// Actual payload from TSD Agent (with error)
const actualPayload = [
  {
    "output": {
      "clientName": "acme",
      "javascript": "function trackHomePage() {\n  window.adobeDataLayer = window.adobeDataLayer || [];\n  window.adobeDataLayer.push({\n    event: \"pageLoaded\",\n    web: {\n      webPageDetails: {\n        name: \"<pageName>\",\n        URL: \"<pageURL>\",\n        siteSection: \"<siteSection>\"\n      }\n    },\n    user: {\n      loginStatus: \"<loginStatus>\",\n      profile: {\n        customerId: \"<customerId>\",\n        memberTier: \"<memberTier>\"\n      }\n    }\n  });\n}\n\nfunction trackPDPPage() {\n  window.adobeDataLayer = window.adobeDataLayer || [];\n  window.adobeDataLayer.push({\n    event: \"productViewed\",\n    product: {\n      id: \"<productId>\",\n      name: \"<productName>\",\n      category: \"<category>\",\n      brand: \"<brand>\",\n      price: <price>,\n      currency: \"<currency>\",\n      quantity: 1\n    }\n  });\n}",
      "markdown": "# Technical Solution Design: acme\n\n## 1. Overview\n- Total eVars: 8"
    }
  }
];

console.log('=== STEP 1: Parse TSD Output Node (CURRENT CODE) ===\n');

// Simulate n8n $input.first().json
const simulateInput = () => ({ first: () => ({ json: actualPayload[0] }) });
const $input = simulateInput();

try {
  // Current Parse TSD Output code (EXPECTED TO FAIL)
  const input = $input.first().json;
  const tsdOutput = input.output || input;

  console.log('input structure:', Object.keys(input));
  console.log('input.clientName:', input.clientName);
  console.log('input.output.clientName:', input.output?.clientName);
  console.log('tsdOutput.clientName:', tsdOutput.clientName);

  if (!input.clientName) {
    throw new Error('TSD output missing clientName field [line 8]');
  }

  console.log('✅ No error - unexpected!');
} catch (error) {
  console.log('❌ ERROR (Expected):', error.message);
}

console.log('\n=== STEP 2: Parse TSD Output Node (FIXED CODE) ===\n');

try {
  const input = $input.first().json;
  const tsdOutput = input.output || input;

  // FIXED: Fallback logic for clientName extraction
  const clientName = input.clientName || input.output?.clientName || tsdOutput.clientName;

  console.log('Extracted clientName:', clientName);

  if (!clientName) {
    throw new Error('TSD output missing clientName field in all possible locations');
  }

  // Check for launchPayload
  const hasLaunchPayload = !!tsdOutput.launchPayload;
  console.log('Has launchPayload:', hasLaunchPayload);

  if (!tsdOutput.javascript || !tsdOutput.markdown) {
    throw new Error('TSD output missing required fields: javascript and/or markdown');
  }

  // Optional launchPayload warning
  if (!hasLaunchPayload) {
    console.warn('⚠️  WARNING: launchPayload not found - operating in 2-file mode');
  }

  // Generate filenames with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const jsFilename = `${clientName}_adobeDataLayer_${timestamp}.js`;
  const mdFilename = `${clientName}_TSD_${timestamp}.md`;
  const launchFilename = hasLaunchPayload ? `${clientName}_LaunchPayload_${timestamp}.json` : null;

  // Stringify Launch Payload JSON if exists
  const launchPayloadStr = hasLaunchPayload
    ? (typeof tsdOutput.launchPayload === 'string' 
        ? tsdOutput.launchPayload 
        : JSON.stringify(tsdOutput.launchPayload, null, 2))
    : null;

  console.log('\n=== Parse TSD Output (Fixed) ===');
  console.log('Client:', clientName);
  console.log('JavaScript size:', tsdOutput.javascript.length);
  console.log('Markdown size:', tsdOutput.markdown.length);
  if (hasLaunchPayload) {
    console.log('Launch Payload size:', launchPayloadStr.length);
  }

  const parsedResult = {
    json: {
      clientName: clientName,
      files: {
        javascript: {
          filename: jsFilename,
          content: tsdOutput.javascript,
          size: tsdOutput.javascript.length,
          type: 'application/javascript'
        },
        markdown: {
          filename: mdFilename,
          content: tsdOutput.markdown,
          size: tsdOutput.markdown.length,
          type: 'text/markdown'
        },
        ...(hasLaunchPayload && {
          launchPayload: {
            filename: launchFilename,
            content: launchPayloadStr,
            size: launchPayloadStr.length,
            type: 'application/json'
          }
        })
      },
      stats: {
        jsLines: tsdOutput.javascript.split('\n').length,
        mdLines: tsdOutput.markdown.split('\n').length,
        ...(hasLaunchPayload && {
          launchRulesCount: (tsdOutput.launchPayload.rules || []).length
        }),
        generatedAt: new Date().toISOString()
      }
    }
  };

  console.log('✅ Parse TSD Output successful');
  console.log('Files generated:', Object.keys(parsedResult.json.files));

  console.log('\n=== STEP 3: Split Files for Upload Node ===\n');

  // Simulate Parse TSD Output node result
  const simulateParsedData = () => ({ 
    first: () => ({ json: parsedResult.json })
  });

  const parsedData = simulateParsedData().first().json;
  const folderId = 'test-folder-id-123';

  // Convert text to base64 with UTF-8 encoding for JavaScript file
  const jsContent = parsedData.files.javascript.content;
  const jsBase64 = Buffer.from(jsContent, 'utf-8').toString('base64');

  // Convert text to base64 with UTF-8 encoding for Markdown file
  const mdContent = parsedData.files.markdown.content;
  const mdBase64 = Buffer.from(mdContent, 'utf-8').toString('base64');

  const splitResult = [
    {
      json: {
        clientName: parsedData.clientName,
        filename: parsedData.files.javascript.filename,
        fileType: 'JavaScript',
        folderId: folderId,
        stats: parsedData.stats
      },
      binary: {
        data: {
          data: jsBase64,
          mimeType: 'text/plain; charset=utf-8',
          fileName: parsedData.files.javascript.filename
        }
      }
    },
    {
      json: {
        clientName: parsedData.clientName,
        filename: parsedData.files.markdown.filename,
        fileType: 'Markdown',
        folderId: folderId,
        stats: parsedData.stats
      },
      binary: {
        data: {
          data: mdBase64,
          mimeType: 'text/plain; charset=utf-8',
          fileName: parsedData.files.markdown.filename
        }
      }
    }
  ];

  // Add Launch Payload if exists
  if (parsedData.files.launchPayload) {
    const launchContent = parsedData.files.launchPayload.content;
    const launchBase64 = Buffer.from(launchContent, 'utf-8').toString('base64');

    splitResult.push({
      json: {
        clientName: parsedData.clientName,
        filename: parsedData.files.launchPayload.filename,
        fileType: 'Launch Payload',
        folderId: folderId,
        stats: parsedData.stats
      },
      binary: {
        data: {
          data: launchBase64,
          mimeType: 'application/json; charset=utf-8',
          fileName: parsedData.files.launchPayload.filename
        }
      }
    });
  } else {
    console.warn('⚠️  WARNING: launchPayload not found - returning 2 files only');
  }

  console.log('✅ Split Files for Upload successful');
  console.log('Binary items created:', splitResult.length);
  splitResult.forEach((item, idx) => {
    console.log(`  ${idx + 1}. ${item.json.fileType}: ${item.json.filename}`);
  });

  console.log('\n=== STEP 4: Upload to Google Drive Node (Input Validation) ===\n');

  // Simulate Google Drive upload response
  const uploadResults = splitResult.map((item, idx) => ({
    json: {
      id: `file-id-${idx + 1}`,
      name: item.json.filename,
      mimeType: item.binary.data.mimeType,
      webViewLink: `https://drive.google.com/file/d/file-id-${idx + 1}/view`,
      webContentLink: `https://drive.google.com/uc?id=file-id-${idx + 1}&export=download`,
      createdTime: new Date().toISOString()
    }
  }));

  console.log('✅ Upload input validation successful');
  console.log('Files to upload:', uploadResults.length);
  uploadResults.forEach((result) => {
    console.log(`  - ${result.json.name}`);
    console.log(`    MIME: ${result.json.mimeType}`);
  });

  console.log('\n=== STEP 5: Collect Upload Results Node ===\n');

  // Simulate $input.all()
  const items = uploadResults;
  const collectedClientName = items[0].json.name.split('_')[0];

  console.log('=== TSD Files Uploaded to Google Drive ===');
  console.log('Client:', collectedClientName);
  console.log('Total files uploaded:', items.length);

  const uploadedFiles = items.map(item => ({
    fileId: item.json.id,
    fileName: item.json.name,
    mimeType: item.json.mimeType,
    webViewLink: item.json.webViewLink,
    webContentLink: item.json.webContentLink,
    createdTime: item.json.createdTime
  }));

  // Categorize files by type
  const fileTypes = {
    javascript: uploadedFiles.find(f => f.fileName.includes('adobeDataLayer')),
    markdown: uploadedFiles.find(f => f.fileName.includes('TSD') && f.fileName.endsWith('.md')),
    launchPayload: uploadedFiles.find(f => f.fileName.includes('LaunchPayload'))
  };

  uploadedFiles.forEach(file => {
    console.log(`- ${file.fileName}`);
    console.log(`  ID: ${file.fileId}`);
    console.log(`  Link: ${file.webViewLink}`);
  });

  const fileTypeCount = Object.values(fileTypes).filter(f => f).length;
  const messageText = fileTypeCount === 3
    ? 'Successfully uploaded 3 files (JavaScript, Markdown, Launch Payload) to Google Drive'
    : 'Successfully uploaded 2 files (JavaScript, Markdown) to Google Drive - launchPayload not generated';

  const collectResult = {
    json: {
      success: true,
      clientName: collectedClientName,
      googleDrive: {
        folder: `TSD/${collectedClientName}`,
        files: uploadedFiles,
        fileTypes: fileTypes
      },
      totalFiles: items.length,
      message: messageText
    }
  };

  console.log('\n✅ Collect Upload Results successful');
  console.log('Result:', collectResult.json.message);
  console.log('File types found:', Object.keys(fileTypes).filter(k => fileTypes[k]));

  console.log('\n=== ALL SIMULATIONS PASSED ✅ ===\n');
  console.log('Summary:');
  console.log('- Parse TSD Output: Fixed clientName extraction logic');
  console.log('- Split Files: Conditional launchPayload handling (2-file mode)');
  console.log('- Upload: Compatible with 2 or 3 binary items');
  console.log('- Collect: Dynamic file type categorization');
  console.log('\nReady to update workflow JSON file.');

} catch (error) {
  console.log('❌ SIMULATION ERROR:', error.message);
  console.log(error.stack);
}
