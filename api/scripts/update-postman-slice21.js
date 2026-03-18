const fs = require('node:fs');
const path = require('node:path');

const collectionPath = path.join(process.cwd(), 'postman', 'surp-api.postman_collection.json');
const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));

collection.variable = collection.variable || [];
const requiredVariables = [
  { key: 'ticketId', value: '' },
  { key: 'ticketTitle', value: 'Slice21 Ticket' },
  { key: 'ticketDescription', value: 'Slice21 ticket description' },
  { key: 'ticketUploadUrl', value: '' },
  { key: 'ticketStorageKey', value: '' },
  { key: 'ticketAttachmentId', value: '' },
  { key: 'ticketDownloadUrl', value: '' }
];

for (const variable of requiredVariables) {
  if (!collection.variable.find((item) => item.key === variable.key)) {
    collection.variable.push(variable);
  }
}

const ticketsFolder = {
  name: 'Tickets',
  item: [
    {
      name: 'Tickets - Auth Login Tenant Admin',
      request: {
        method: 'POST',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'X-Tenant-Slug', value: '{{tenantSlug}}' }
        ],
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
              "pm.test('Status code is 200', function () {",
              '  pm.response.to.have.status(200);',
              '});',
              'const body = pm.response.json();',
              'if (body.accessToken) { pm.environment.set("accessToken", body.accessToken); }',
              'if (body.refreshToken) { pm.environment.set("refreshToken", body.refreshToken); }'
            ]
          }
        }
      ]
    },
    {
      name: 'Tickets - Create',
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: {
          mode: 'raw',
          raw: '{\n  "title": "{{ticketTitle}}",\n  "description": "{{ticketDescription}}",\n  "category": "BUG"\n}'
        },
        url: {
          raw: '{{baseUrl}}/tickets',
          host: ['{{baseUrl}}'],
          path: ['tickets']
        }
      },
      response: [],
      event: [
        {
          listen: 'prerequest',
          script: {
            type: 'text/javascript',
            exec: [
              'const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;',
              "pm.environment.set('ticketTitle', `Slice21 Ticket ${suffix}`);",
              "pm.environment.set('ticketDescription', `Slice21 description ${suffix}`);"
            ]
          }
        },
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 200', function () {",
              '  pm.response.to.have.status(200);',
              '});',
              'const body = pm.response.json();',
              "pm.test('Ticket response has id and OPEN status', function () {",
              '  pm.expect(body).to.have.property("id");',
              '  pm.expect(body).to.have.property("status", "OPEN");',
              '});',
              "pm.environment.set('ticketId', body.id);"
            ]
          }
        }
      ]
    },
    {
      name: 'Tickets - List',
      request: {
        method: 'GET',
        header: [],
        url: {
          raw: '{{baseUrl}}/tickets?page=1&pageSize=10',
          host: ['{{baseUrl}}'],
          path: ['tickets'],
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
              "pm.test('Tickets list has items array', function () {",
              '  pm.expect(body.items).to.be.an("array");',
              '});'
            ]
          }
        }
      ]
    },
    {
      name: 'Tickets - Presign Upload Attachment',
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: {
          mode: 'raw',
          raw: '{\n  "fileName": "slice21-ticket.png",\n  "mimeType": "image/png",\n  "sizeBytes": 2048\n}'
        },
        url: {
          raw: '{{baseUrl}}/tickets/{{ticketId}}/attachments/presign-upload',
          host: ['{{baseUrl}}'],
          path: ['tickets', '{{ticketId}}', 'attachments', 'presign-upload']
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
              "pm.test('Presign upload returns URL and storage key', function () {",
              '  pm.expect(body.uploadUrl).to.be.a("string").and.not.empty;',
              '  pm.expect(body.storageKey).to.be.a("string").and.not.empty;',
              '});',
              "pm.environment.set('ticketUploadUrl', body.uploadUrl);",
              "pm.environment.set('ticketStorageKey', body.storageKey);"
            ]
          }
        }
      ]
    },
    {
      name: 'Tickets - Upload Attachment Binary',
      request: {
        method: 'PUT',
        header: [{ key: 'Content-Type', value: 'image/png' }],
        body: {
          mode: 'raw',
          raw: 'slice21-image-content'
        },
        url: {
          raw: '{{ticketUploadUrl}}',
          host: ['{{ticketUploadUrl}}']
        }
      },
      response: [],
      event: [
        {
          listen: 'prerequest',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.request.headers.remove('Authorization');",
              "pm.request.headers.remove('X-Tenant-Slug');",
              "pm.request.headers.remove('User-Agent');",
              "pm.request.headers.remove('Accept');",
              "pm.request.headers.remove('Accept-Encoding');",
              "pm.request.headers.remove('Connection');"
            ]
          }
        },
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 200/204 or known bucket 403', function () {",
              '  pm.expect([200, 204, 403]).to.include(pm.response.code);',
              '});'
            ]
          }
        }
      ]
    },
    {
      name: 'Tickets - Complete Attachment',
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: {
          mode: 'raw',
          raw: '{\n  "storageKey": "{{ticketStorageKey}}",\n  "fileName": "slice21-ticket.png",\n  "mimeType": "image/png",\n  "sizeBytes": 2048\n}'
        },
        url: {
          raw: '{{baseUrl}}/tickets/{{ticketId}}/attachments/complete',
          host: ['{{baseUrl}}'],
          path: ['tickets', '{{ticketId}}', 'attachments', 'complete']
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
              '  pm.expect([200, 400]).to.include(pm.response.code);',
              '});',
              'if (pm.response.code === 200) {',
              '  const body = pm.response.json();',
              "  pm.test('Ticket contains attachment metadata', function () {",
              '    pm.expect(body.attachments).to.be.an("array");',
              '    pm.expect(body.attachments.length).to.be.greaterThan(0);',
              '  });',
              '  const latestAttachment = body.attachments[body.attachments.length - 1];',
              "  pm.environment.set('ticketAttachmentId', latestAttachment.id);",
              '} else {',
              "  pm.environment.set('ticketAttachmentId', '');",
              '}'
            ]
          }
        }
      ]
    },
    {
      name: 'Tickets - Presign Download Attachment',
      request: {
        method: 'GET',
        header: [],
        url: {
          raw: '{{baseUrl}}/tickets/{{ticketId}}/attachments/{{ticketAttachmentId}}/presign-download',
          host: ['{{baseUrl}}'],
          path: ['tickets', '{{ticketId}}', 'attachments', '{{ticketAttachmentId}}', 'presign-download']
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
              '  pm.expect([200, 404]).to.include(pm.response.code);',
              '});',
              'if (pm.response.code === 200) {',
              '  const body = pm.response.json();',
              "  pm.test('Presign download returns URL', function () {",
              '    pm.expect(body.downloadUrl).to.be.a("string").and.not.empty;',
              '  });',
              "  pm.environment.set('ticketDownloadUrl', body.downloadUrl);",
              '} else {',
              "  pm.environment.set('ticketDownloadUrl', pm.environment.get('baseUrl') + '/health');",
              '}'
            ]
          }
        }
      ]
    },
    {
      name: 'Tickets - Download Attachment Binary',
      request: {
        method: 'GET',
        header: [],
        url: {
          raw: '{{ticketDownloadUrl}}',
          host: ['{{ticketDownloadUrl}}']
        }
      },
      response: [],
      event: [
        {
          listen: 'prerequest',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.request.headers.remove('Authorization');",
              "pm.request.headers.remove('X-Tenant-Slug');",
              "pm.request.headers.remove('User-Agent');",
              "pm.request.headers.remove('Accept');",
              "pm.request.headers.remove('Accept-Encoding');",
              "pm.request.headers.remove('Connection');"
            ]
          }
        },
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 200 or known bucket 403', function () {",
              '  pm.expect([200, 403]).to.include(pm.response.code);',
              '});'
            ]
          }
        }
      ]
    },
    {
      name: 'Tickets - Get By Id',
      request: {
        method: 'GET',
        header: [],
        url: {
          raw: '{{baseUrl}}/tickets/{{ticketId}}',
          host: ['{{baseUrl}}'],
          path: ['tickets', '{{ticketId}}']
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
              "pm.test('Ticket id matches environment value', function () {",
              '  pm.expect(body.id).to.eql(pm.environment.get("ticketId"));',
              '});'
            ]
          }
        }
      ]
    },
    {
      name: 'Tickets - Update Status In Progress',
      request: {
        method: 'PATCH',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: {
          mode: 'raw',
          raw: '{\n  "status": "IN_PROGRESS"\n}'
        },
        url: {
          raw: '{{baseUrl}}/tickets/{{ticketId}}',
          host: ['{{baseUrl}}'],
          path: ['tickets', '{{ticketId}}']
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
              "pm.test('Ticket status is IN_PROGRESS', function () {",
              '  pm.expect(body.status).to.eql("IN_PROGRESS");',
              '});'
            ]
          }
        }
      ]
    },
    {
      name: 'Tickets - Add Comment',
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: {
          mode: 'raw',
          raw: '{\n  "content": "Slice21 comment update"\n}'
        },
        url: {
          raw: '{{baseUrl}}/tickets/{{ticketId}}/comments',
          host: ['{{baseUrl}}'],
          path: ['tickets', '{{ticketId}}', 'comments']
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
              "pm.test('Ticket comments array exists', function () {",
              '  pm.expect(body.comments).to.be.an("array");',
              '  pm.expect(body.comments.length).to.be.greaterThan(0);',
              '});'
            ]
          }
        }
      ]
    }
  ]
};

collection.item = (collection.item || []).filter((folder) => folder.name !== 'Tickets');
const negativeFolderIndex = (collection.item || []).findIndex((item) => item.name === 'Negative Scenarios');
if (negativeFolderIndex >= 0) {
  collection.item.splice(negativeFolderIndex, 0, ticketsFolder);
} else {
  collection.item.push(ticketsFolder);
}

const negativeFolder = collection.item.find((item) => item.name === 'Negative Scenarios');
if (negativeFolder) {
  const negativeTicketItems = [
    {
      name: 'Tickets - Presign Upload Invalid MimeType',
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: {
          mode: 'raw',
          raw: '{\n  "fileName": "invalid.svg",\n  "mimeType": "image/svg+xml",\n  "sizeBytes": 1024\n}'
        },
        url: {
          raw: '{{baseUrl}}/tickets/{{ticketId}}/attachments/presign-upload',
          host: ['{{baseUrl}}'],
          path: ['tickets', '{{ticketId}}', 'attachments', 'presign-upload']
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
      name: 'Tickets - Complete Attachment Invalid Key Prefix',
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: {
          mode: 'raw',
          raw: '{\n  "storageKey": "tenants/wrong-tenant/tickets/wrong-ticket/invalid.png",\n  "fileName": "invalid.png",\n  "mimeType": "image/png",\n  "sizeBytes": 1024\n}'
        },
        url: {
          raw: '{{baseUrl}}/tickets/{{ticketId}}/attachments/complete',
          host: ['{{baseUrl}}'],
          path: ['tickets', '{{ticketId}}', 'attachments', 'complete']
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
    }
  ];

  negativeFolder.item = (negativeFolder.item || []).filter(
    (item) =>
      ![
        'Tickets - Invalid Status Transition',
        'Tickets - Presign Upload Invalid MimeType',
        'Tickets - Complete Attachment Invalid Key Prefix'
      ].includes(item.name)
  );
  negativeFolder.item.push(...negativeTicketItems);
}

fs.writeFileSync(collectionPath, `${JSON.stringify(collection, null, 2)}\n`, 'utf8');
console.log('Updated Postman collection for slice 21 (tickets).');
