'use strict';

const msal = require('@azure/msal-node');

let cca;

function getConfidentialClient() {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing AZURE_TENANT_ID, AZURE_CLIENT_ID, or AZURE_CLIENT_SECRET');
  }
  if (!cca) {
    cca = new msal.ConfidentialClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        clientSecret,
      },
    });
  }
  return cca;
}

/**
 * App-only token for Microsoft Graph (client credentials).
 * Entra: grant admin consent for application permissions (e.g. Sites.ReadWrite.All).
 */
async function acquireGraphToken() {
  const client = getConfidentialClient();
  const result = await client.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });
  if (!result?.accessToken) {
    throw new Error('Failed to acquire Graph access token');
  }
  return result.accessToken;
}

module.exports = { acquireGraphToken };
