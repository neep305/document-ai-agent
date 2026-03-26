'use strict';

const GRAPH = 'https://graph.microsoft.com/v1.0';

/** Above this size, use createUploadSession + chunked PUT (Graph 권장 패턴). */
function sessionThresholdBytes() {
  const mb = Number(process.env.GRAPH_UPLOAD_SESSION_THRESHOLD_MB || 4);
  const n = Number.isFinite(mb) && mb > 0 ? mb : 4;
  return n * 1024 * 1024;
}

/**
 * Build /sites/... segment for Graph.
 * Use GRAPH_SITE_ID (GUID) or GRAPH_SITE_PATH (e.g. contoso.sharepoint.com:/sites/TeamName)
 */
function sitePathSegment() {
  const siteId = process.env.GRAPH_SITE_ID?.trim();
  const sitePath = process.env.GRAPH_SITE_PATH?.trim();
  if (siteId) return `sites/${siteId}`;
  if (sitePath) return `sites/${sitePath}`;
  throw new Error('Set GRAPH_SITE_ID or GRAPH_SITE_PATH');
}

function buildItemPath(folderPath, fileName) {
  const safeFolder = (folderPath || '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  return safeFolder
    ? `${safeFolder}/${fileName}`.replace(/\\/g, '/')
    : fileName;
}

function encodeItemPathSegments(itemPath) {
  return itemPath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

async function graphJson(res, label) {
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`${label}: ${res.status} ${text}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/**
 * Simple single PUT (suitable for smaller files).
 */
async function uploadSimplePut(accessToken, site, encodedItemPath, buffer) {
  const url = `${GRAPH}/${site}/drive/root:/${encodedItemPath}:/content`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: buffer,
  });
  return graphJson(res, 'Graph upload failed');
}

/**
 * Large file: createUploadSession then chunked upload (320 KiB aligned chunk size).
 */
async function uploadViaSession(accessToken, site, encodedItemPath, buffer) {
  const sessionUrl = `${GRAPH}/${site}/drive/root:/${encodedItemPath}:/createUploadSession`;
  const sessionRes = await fetch(sessionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      item: {
        '@microsoft.graph.conflictBehavior': 'replace',
      },
    }),
  });
  const session = await graphJson(sessionRes, 'Graph createUploadSession failed');
  const uploadUrl = session.uploadUrl;
  if (!uploadUrl) {
    throw new Error('Graph createUploadSession missing uploadUrl');
  }

  const total = buffer.length;
  const chunkSize = 320 * 1024 * 8; // 2.5 MiB, multiple of 320 KiB
  let start = 0;
  let lastResponse = null;

  while (start < total) {
    const end = Math.min(start + chunkSize, total) - 1;
    const chunk = buffer.subarray(start, end + 1);
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.length),
        'Content-Range': `bytes ${start}-${end}/${total}`,
      },
      body: chunk,
    });
    const text = await res.text();
    if (res.status === 200 || res.status === 201) {
      try {
        lastResponse = text ? JSON.parse(text) : {};
      } catch {
        lastResponse = { raw: text };
      }
      break;
    }
    if (res.status === 202) {
      start = end + 1;
      continue;
    }
    const err = new Error(`Graph chunk upload failed: ${res.status} ${text}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }

  if (!lastResponse) {
    throw new Error('Graph upload session finished without drive item response');
  }
  return lastResponse;
}

/**
 * Upload bytes to the site's default drive: root:/folder/file
 */
async function uploadToSiteDriveRoot(accessToken, folderPath, fileName, buffer) {
  const site = sitePathSegment();
  const itemPath = buildItemPath(folderPath, fileName);
  const encoded = encodeItemPathSegments(itemPath);

  if (buffer.length <= sessionThresholdBytes()) {
    return uploadSimplePut(accessToken, site, encoded, buffer);
  }
  return uploadViaSession(accessToken, site, encoded, buffer);
}

module.exports = { uploadToSiteDriveRoot, sitePathSegment };
