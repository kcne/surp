const fs = require('fs');
const path = require('path');

const postmanPath = path.join(__dirname, '..', 'postman', 'surp-api.postman_collection.json');
const outDir = path.join(__dirname, '..', 'insomnia');
const outPath = path.join(outDir, 'surp-api.insomnia_collection.json');

const postman = JSON.parse(fs.readFileSync(postmanPath, 'utf8'));

const workspaceId = 'wrk_surp_api';
const envId = 'env_surp_api_base';

const resources = [
  {
    _id: workspaceId,
    _type: 'workspace',
    parentId: null,
    name: 'SURP API (Insomnia)',
    description: 'Insomnia-native export generated from Postman collection'
  },
  {
    _id: envId,
    _type: 'environment',
    parentId: workspaceId,
    name: 'Base Environment',
    data: Object.fromEntries((postman.variable || []).map((v) => [v.key, v.value]))
  }
];

const slug = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'item';

const toHeaders = (headers) =>
  (headers || []).map((header) => ({
    name: header.key,
    value: header.value || '',
    disabled: Boolean(header.disabled)
  }));

const toBody = (body) => {
  if (!body || body.mode !== 'raw') {
    return {};
  }

  return {
    mimeType: 'application/json',
    body: {
      mimeType: 'application/json',
      text: body.raw || ''
    }
  };
};

let requestCounter = 0;
for (const folder of postman.item || []) {
  const folderId = `fld_${slug(folder.name)}`;
  resources.push({
    _id: folderId,
    _type: 'request_group',
    parentId: workspaceId,
    name: folder.name
  });

  for (const requestItem of folder.item || []) {
    if (!requestItem.request) {
      continue;
    }

    requestCounter += 1;
    const request = requestItem.request;
    resources.push({
      _id: `req_${String(requestCounter).padStart(3, '0')}_${slug(requestItem.name)}`,
      _type: 'request',
      parentId: folderId,
      name: requestItem.name,
      method: request.method || 'GET',
      url: request.url?.raw || '',
      headers: toHeaders(request.header),
      ...toBody(request.body)
    });
  }
}

const exportDoc = {
  _type: 'export',
  __export_format: 4,
  __export_date: new Date().toISOString(),
  __export_source: 'github-copilot-gpt-5.3-codex',
  resources
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(exportDoc, null, 2)}\n`);
console.log(`Wrote ${path.relative(path.join(__dirname, '..'), outPath)} with ${resources.length} resources.`);
