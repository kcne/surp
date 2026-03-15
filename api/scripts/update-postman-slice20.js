const fs = require('node:fs');
const path = require('node:path');

const collectionPath = path.join(process.cwd(), 'postman', 'surp-api.postman_collection.json');
const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));

collection.variable = collection.variable || [];
const requiredVariables = [
  { key: 'passwordResetUsername', value: 'slice20_reset_user' },
  { key: 'passwordResetEmail', value: 'slice20_reset_user@demo.local' },
  { key: 'passwordResetOriginalPassword', value: 'reset-user-pass-123' },
  { key: 'passwordResetNewPassword', value: 'reset-user-new-pass-123' },
  { key: 'passwordResetUserId', value: '' },
  { key: 'passwordResetTargetUserId', value: '' }
];

for (const variable of requiredVariables) {
  if (!collection.variable.find((item) => item.key === variable.key)) {
    collection.variable.push(variable);
  }
}

const usersFolder = collection.item.find((item) => item.name === 'Users');
if (!usersFolder) {
  throw new Error('Users folder not found');
}

const passwordResetFolder = {
  name: 'Password Reset',
  item: [
    {
      name: 'Create Password Reset User (Admin)',
      request: {
        method: 'POST',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'X-Tenant-Slug', value: '{{tenantSlug}}' },
          { key: 'Authorization', value: 'Bearer {{accessToken}}' }
        ],
        body: {
          mode: 'raw',
          raw: '{\n  "username": "{{passwordResetUsername}}",\n  "email": "{{passwordResetEmail}}",\n  "password": "{{passwordResetOriginalPassword}}",\n  "role": "STAFF"\n}'
        },
        url: {
          raw: '{{baseUrl}}/users',
          host: ['{{baseUrl}}'],
          path: ['users']
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
              "pm.environment.set('passwordResetUsername', `reset_user_${suffix}`);",
              "pm.environment.set('passwordResetEmail', `reset_user_${suffix}@demo.local`);"
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
              'if (body.id) {',
              "  pm.environment.set('passwordResetUserId', body.id);",
              '}'
            ]
          }
        }
      ]
    },
    {
      name: 'Reset Password (Admin)',
      request: {
        method: 'POST',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'X-Tenant-Slug', value: '{{tenantSlug}}' },
          { key: 'Authorization', value: 'Bearer {{accessToken}}' }
        ],
        body: {
          mode: 'raw',
          raw: '{\n  "newPassword": "{{passwordResetNewPassword}}",\n  "requirePasswordChange": false\n}'
        },
        url: {
          raw: '{{baseUrl}}/users/{{passwordResetUserId}}/reset-password',
          host: ['{{baseUrl}}'],
          path: ['users', '{{passwordResetUserId}}', 'reset-password']
        }
      },
      response: [],
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 201', function () {",
              '  pm.response.to.have.status(201);',
              '});',
              'const body = pm.response.json();',
              "pm.test('Reset response includes password policy flag', function () {",
              '  pm.expect(body).to.have.property("requirePasswordChange", false);',
              '});'
            ]
          }
        }
      ]
    },
    {
      name: 'Login With Old Password Fails',
      request: {
        method: 'POST',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'X-Tenant-Slug', value: '{{tenantSlug}}' }
        ],
        body: {
          mode: 'raw',
          raw: '{\n  "username": "{{passwordResetUsername}}",\n  "password": "{{passwordResetOriginalPassword}}"\n}'
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
      name: 'Login With New Password Succeeds',
      request: {
        method: 'POST',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'X-Tenant-Slug', value: '{{tenantSlug}}' }
        ],
        body: {
          mode: 'raw',
          raw: '{\n  "username": "{{passwordResetUsername}}",\n  "password": "{{passwordResetNewPassword}}"\n}'
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
              '});'
            ]
          }
        }
      ]
    }
  ]
};

usersFolder.item = usersFolder.item.filter((item) => item.name !== 'Password Reset');
usersFolder.item.push(passwordResetFolder);

const negativeFolder = collection.item.find((item) => item.name === 'Negative Scenarios');
if (negativeFolder) {
  const negativeItems = [
    {
      name: 'Users - Reset Password Invalid Password',
      request: {
        method: 'POST',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'X-Tenant-Slug', value: '{{tenantSlug}}' },
          { key: 'Authorization', value: 'Bearer {{accessToken}}' }
        ],
        body: {
          mode: 'raw',
          raw: '{\n  "newPassword": "short"\n}'
        },
        url: {
          raw: '{{baseUrl}}/users/{{passwordResetTargetUserId}}/reset-password',
          host: ['{{baseUrl}}'],
          path: ['users', '{{passwordResetTargetUserId}}', 'reset-password']
        }
      },
      response: [],
      event: [
        {
          listen: 'prerequest',
          script: {
            type: 'text/javascript',
            exec: [
              "const targetUserId = pm.environment.get('passwordResetUserId') || pm.environment.get('currentUserId') || 'fallback-user-id';",
              "pm.environment.set('passwordResetTargetUserId', targetUserId);"
            ]
          }
        },
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
      name: 'Users - Reset Password Unknown User',
      request: {
        method: 'POST',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'X-Tenant-Slug', value: '{{tenantSlug}}' },
          { key: 'Authorization', value: 'Bearer {{accessToken}}' }
        ],
        body: {
          mode: 'raw',
          raw: '{\n  "newPassword": "{{passwordResetNewPassword}}"\n}'
        },
        url: {
          raw: '{{baseUrl}}/users/not-a-real-user/reset-password',
          host: ['{{baseUrl}}'],
          path: ['users', 'not-a-real-user', 'reset-password']
        }
      },
      response: [],
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 404', function () {",
              '  pm.response.to.have.status(404);',
              '});'
            ]
          }
        }
      ]
    }
  ];

  const remaining = negativeFolder.item.filter(
    (item) => !['Users - Reset Password Invalid Password', 'Users - Reset Password Unknown User'].includes(item.name)
  );
  negativeFolder.item = [...remaining, ...negativeItems];
}

fs.writeFileSync(collectionPath, `${JSON.stringify(collection, null, 2)}\n`, 'utf8');
console.log('Updated Postman collection for slice 20.');
