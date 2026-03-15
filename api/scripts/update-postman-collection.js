const fs = require('node:fs');
const path = require('node:path');

const collectionPath = path.join(process.cwd(), 'postman', 'surp-api.postman_collection.json');
const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));

const prerequestScript = [
  "const rawUrl = pm.request.url.toString();",
  "const requestName = pm.info.requestName || '';",
  "const isPlatformRequest = /^Platform /.test(requestName) || /\\/platform\\//.test(rawUrl);",
  "const tenantSlug = pm.environment.get('tenantSlug') || pm.collectionVariables.get('tenantSlug');",
  "const skipTenantHeader = /Missing Tenant Header/.test(requestName) || isPlatformRequest;",
  "const skipAuthHeader = /Missing Token|Invalid Token/.test(requestName);",
  "const skipAutoAuth = /Missing Token|Invalid Token|Missing Tenant Header/.test(requestName) || isPlatformRequest;",
  "",
  "if (tenantSlug && !skipTenantHeader) {",
  "  pm.request.headers.upsert({ key: 'X-Tenant-Slug', value: tenantSlug });",
  "}",
  "",
  "const isPublic = /\\/health(?:\\/readiness)?$/.test(rawUrl) || /\\/auth\\/(login|refresh|logout)$/.test(rawUrl);",
  "if (isPublic) {",
  "  return;",
  "}",
  "",
  "const accessToken = pm.environment.get('accessToken');",
  "if (accessToken && !skipAuthHeader) {",
  "  pm.request.headers.upsert({ key: 'Authorization', value: `Bearer ${accessToken}` });",
  "}",
  "",
  "const autoAuth = (pm.environment.get('autoAuth') || 'true').toLowerCase() === 'true';",
  "if (!accessToken && autoAuth && !skipAutoAuth) {",
  "  pm.sendRequest(",
  "    {",
  "      url: `${pm.environment.get('baseUrl') || pm.collectionVariables.get('baseUrl')}/auth/login`,",
  "      method: 'POST',",
  "      header: {",
  "        'Content-Type': 'application/json',",
  "        'X-Tenant-Slug': tenantSlug",
  "      },",
  "      body: {",
  "        mode: 'raw',",
  "        raw: JSON.stringify({",
  "          username:",
  "            pm.environment.get('loginIdentifier') ||",
  "            pm.collectionVariables.get('loginIdentifier') ||",
  "            pm.environment.get('username') ||",
  "            pm.collectionVariables.get('username'),",
  "          password: pm.environment.get('password') || pm.collectionVariables.get('password')",
  "        })",
  "      }",
  "    },",
  "    (error, response) => {",
  "      if (error || response.code !== 200) {",
  "        console.log('Auto login failed', error || response.code);",
  "        return;",
  "      }",
  "",
  "      const body = response.json();",
  "      if (body.accessToken) {",
  "        pm.environment.set('accessToken', body.accessToken);",
  "        pm.request.headers.upsert({ key: 'Authorization', value: `Bearer ${body.accessToken}` });",
  "      }",
  "      if (body.refreshToken) {",
  "        pm.environment.set('refreshToken', body.refreshToken);",
  "      }",
  "    }",
  "  );",
  "}",
  "",
  "const tokenRefreshMode = (pm.environment.get('tokenRefreshMode') || 'never').toLowerCase();",
  "const refreshToken = pm.environment.get('refreshToken');",
  "if (tokenRefreshMode === 'always' && refreshToken && !skipAutoAuth) {",
  "  pm.sendRequest(",
  "    {",
  "      url: `${pm.environment.get('baseUrl') || pm.collectionVariables.get('baseUrl')}/auth/refresh`,",
  "      method: 'POST',",
  "      header: {",
  "        'Content-Type': 'application/json',",
  "        'X-Tenant-Slug': tenantSlug",
  "      },",
  "      body: {",
  "        mode: 'raw',",
  "        raw: JSON.stringify({ refreshToken })",
  "      }",
  "    },",
  "    (error, response) => {",
  "      if (error || response.code !== 200) {",
  "        console.log('Auto refresh failed', error || response.code);",
  "        return;",
  "      }",
  "",
  "      const body = response.json();",
  "      if (body.accessToken) {",
  "        pm.environment.set('accessToken', body.accessToken);",
  "        pm.request.headers.upsert({ key: 'Authorization', value: `Bearer ${body.accessToken}` });",
  "      }",
  "      if (body.refreshToken) {",
  "        pm.environment.set('refreshToken', body.refreshToken);",
  "      }",
  "    }",
  "  );",
  "}"
];

collection.event = [
  {
    listen: 'prerequest',
    script: {
      type: 'text/javascript',
      exec: prerequestScript
    }
  }
];

collection.variable = collection.variable || [];
const requiredVariables = [
  { key: 'baseUrl', value: 'http://localhost:3001' },
  { key: 'tenantSlug', value: 'demo-tenant' },
  { key: 'platformTenantSlug', value: 'platform' },
  { key: 'platformSuperadminUsername', value: 'platform-superadmin' },
  { key: 'platformSuperadminPassword', value: 'platform-superadmin-pass' },
  { key: 'platformTenantId', value: '' },
  { key: 'newPlatformTenantSlug', value: '' },
  { key: 'loginIdentifier', value: 'demo-admin' },
  { key: 'password', value: 'demo-admin-pass' },
  { key: 'invalidPassword', value: 'invalid-pass' },
  { key: 'accessToken', value: '' },
  { key: 'refreshToken', value: '' },
  { key: 'autoAuth', value: 'true' },
  { key: 'tokenRefreshMode', value: 'never' }
];

for (const variable of requiredVariables) {
  const existing = collection.variable.find((item) => item.key === variable.key);
  if (!existing) {
    collection.variable.push(variable);
  }
}

const negativeScenariosFolder = {
  name: 'Negative Scenarios',
  item: [
    {
      name: 'Auth - Login Missing Tenant Header',
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: {
          mode: 'raw',
          raw: '{\n  "username": "{{loginIdentifier}}",\n  "password": "{{password}}"\n}'
        },
        url: {
          raw: '{{baseUrl}}/auth/login',
          host: ['{{baseUrl}}'],
          path: ['auth', 'login']
        }
      },
      response: [],
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 400', function () {",
              '  pm.response.to.have.status(400);',
              '});'
            ]
          }
        }
      ]
    },
    {
      name: 'Auth - Login Invalid Password',
      request: {
        method: 'POST',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'X-Tenant-Slug', value: '{{tenantSlug}}' }
        ],
        body: {
          mode: 'raw',
          raw: '{\n  "username": "{{loginIdentifier}}",\n  "password": "{{invalidPassword}}"\n}'
        },
        url: {
          raw: '{{baseUrl}}/auth/login',
          host: ['{{baseUrl}}'],
          path: ['auth', 'login']
        }
      },
      response: [],
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 401', function () {",
              '  pm.response.to.have.status(401);',
              '});'
            ]
          }
        }
      ]
    },
    {
      name: 'Users - Missing Token',
      request: {
        method: 'GET',
        header: [{ key: 'X-Tenant-Slug', value: '{{tenantSlug}}' }],
        url: {
          raw: '{{baseUrl}}/users?page=1&pageSize=5',
          host: ['{{baseUrl}}'],
          path: ['users'],
          query: [
            { key: 'page', value: '1' },
            { key: 'pageSize', value: '5' }
          ]
        }
      },
      response: [],
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 401', function () {",
              '  pm.response.to.have.status(401);',
              '});'
            ]
          }
        }
      ]
    },
    {
      name: 'Users - Invalid Token',
      request: {
        method: 'GET',
        header: [
          { key: 'X-Tenant-Slug', value: '{{tenantSlug}}' },
          { key: 'Authorization', value: 'Bearer invalid-token' }
        ],
        url: {
          raw: '{{baseUrl}}/users?page=1&pageSize=5',
          host: ['{{baseUrl}}'],
          path: ['users'],
          query: [
            { key: 'page', value: '1' },
            { key: 'pageSize', value: '5' }
          ]
        }
      },
      response: [],
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 401', function () {",
              '  pm.response.to.have.status(401);',
              '});'
            ]
          }
        }
      ]
    }
  ]
};

const platformTenantsFolder = {
  name: 'Platform Tenants',
  item: [
    {
      name: 'Platform Auth - Login Superadmin',
      request: {
        method: 'POST',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'X-Tenant-Slug', value: '{{platformTenantSlug}}' }
        ],
        body: {
          mode: 'raw',
          raw: '{\n  "username": "{{platformSuperadminUsername}}",\n  "password": "{{platformSuperadminPassword}}"\n}'
        },
        url: {
          raw: '{{baseUrl}}/auth/login',
          host: ['{{baseUrl}}'],
          path: ['auth', 'login']
        }
      },
      response: [],
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 200', function () {",
              '  pm.response.to.have.status(200);',
              '});',
              'const body = pm.response.json();',
              'if (body.accessToken) { pm.environment.set(\'accessToken\', body.accessToken); }',
              'if (body.refreshToken) { pm.environment.set(\'refreshToken\', body.refreshToken); }'
            ]
          }
        }
      ]
    },
    {
      name: 'Platform Tenants - Create Tenant',
      event: [
        {
          listen: 'prerequest',
          script: {
            type: 'text/javascript',
            exec: [
              "const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;",
              "pm.environment.set('newPlatformTenantSlug', `platform-tenant-${suffix}`);"
            ]
          }
        },
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 201', function () {",
              '  pm.response.to.have.status(201);',
              '});',
              'const body = pm.response.json();',
              'if (body.id) { pm.environment.set(\'platformTenantId\', body.id); }'
            ]
          }
        }
      ],
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: {
          mode: 'raw',
          raw: '{\n  "slug": "{{newPlatformTenantSlug}}",\n  "name": "Platform Tenant {{newPlatformTenantSlug}}"\n}'
        },
        url: {
          raw: '{{baseUrl}}/platform/tenants',
          host: ['{{baseUrl}}'],
          path: ['platform', 'tenants']
        }
      },
      response: []
    },
    {
      name: 'Platform Tenants - Get Tenant',
      request: {
        method: 'GET',
        header: [],
        url: {
          raw: '{{baseUrl}}/platform/tenants/{{platformTenantId}}',
          host: ['{{baseUrl}}'],
          path: ['platform', 'tenants', '{{platformTenantId}}']
        }
      },
      response: [],
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 200', function () {",
              '  pm.response.to.have.status(200);',
              '});'
            ]
          }
        }
      ]
    },
    {
      name: 'Platform Tenants - Deactivate Tenant',
      request: {
        method: 'PATCH',
        header: [],
        url: {
          raw: '{{baseUrl}}/platform/tenants/{{platformTenantId}}/deactivate',
          host: ['{{baseUrl}}'],
          path: ['platform', 'tenants', '{{platformTenantId}}', 'deactivate']
        }
      },
      response: [],
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 200', function () {",
              '  pm.response.to.have.status(200);',
              '});',
              'const body = pm.response.json();',
              "pm.test('Tenant is inactive after deactivation', function () {",
              '  pm.expect(body.isActive).to.eql(false);',
              '});'
            ]
          }
        }
      ]
    },
    {
      name: 'Platform Tenants - Activate Tenant',
      request: {
        method: 'PATCH',
        header: [],
        url: {
          raw: '{{baseUrl}}/platform/tenants/{{platformTenantId}}/activate',
          host: ['{{baseUrl}}'],
          path: ['platform', 'tenants', '{{platformTenantId}}', 'activate']
        }
      },
      response: [],
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 200', function () {",
              '  pm.response.to.have.status(200);',
              '});',
              'const body = pm.response.json();',
              "pm.test('Tenant is active after activation', function () {",
              '  pm.expect(body.isActive).to.eql(true);',
              '});'
            ]
          }
        }
      ]
    },
    {
      name: 'Platform Tenants - List Tenants',
      request: {
        method: 'GET',
        header: [],
        url: {
          raw: '{{baseUrl}}/platform/tenants?page=1&pageSize=10',
          host: ['{{baseUrl}}'],
          path: ['platform', 'tenants'],
          query: [
            { key: 'page', value: '1' },
            { key: 'pageSize', value: '10' }
          ]
        }
      },
      response: [],
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 200', function () {",
              '  pm.response.to.have.status(200);',
              '});',
              'const body = pm.response.json();',
              "pm.test('Response contains array of tenants', function () {",
              '  pm.expect(body.items).to.be.an(\'array\');',
              '});'
            ]
          }
        }
      ]
    }
  ]
};

collection.item = (collection.item || []).filter((folder) => folder.name !== 'Negative Scenarios');
collection.item.push(negativeScenariosFolder);
collection.item = (collection.item || []).filter((folder) => folder.name !== 'Platform Tenants');
collection.item.push(platformTenantsFolder);

const addUniqueUserSeedScript = (items) => {
  for (const item of items || []) {
    if (item.item) {
      addUniqueUserSeedScript(item.item);
      continue;
    }

    if (item.name !== 'Create User - Manager (Admin)') {
      continue;
    }

    item.event = item.event || [];
    item.event = item.event.filter((eventItem) => eventItem.listen !== 'prerequest');
    item.event.unshift({
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        exec: [
          "const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;",
          "pm.environment.set('newManagerUsername', `manager_${suffix}`);",
          "pm.environment.set('newManagerEmail', `manager_${suffix}@demo.local`);",
          "pm.environment.set('duplicateEmail', `manager_${suffix}@demo.local`);"
        ]
      }
    });
  }
};

addUniqueUserSeedScript(collection.item);

fs.writeFileSync(collectionPath, `${JSON.stringify(collection, null, 2)}\n`, 'utf8');
console.log('Postman collection updated:', collectionPath);
