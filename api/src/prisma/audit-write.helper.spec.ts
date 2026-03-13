import { withCreateAudit, withUpdateAudit } from './audit-write.helper';

describe('audit write helper', () => {
  it('injects actor as createdById and updatedById on create', () => {
    const result = withCreateAudit(
      {
        username: 'ops-manager',
        createdById: 'spoofed',
        updatedById: 'spoofed'
      },
      'admin-1'
    );

    expect(result).toEqual({
      username: 'ops-manager',
      createdById: 'admin-1',
      updatedById: 'admin-1'
    });
  });

  it('injects actor into updatedById and adds updatedAt on update', () => {
    const now = new Date('2026-03-13T00:00:00.000Z');

    const result = withUpdateAudit(
      {
        isActive: false,
        createdById: 'spoofed',
        updatedById: 'spoofed'
      },
      'admin-2',
      now
    );

    expect(result).toEqual({
      isActive: false,
      updatedById: 'admin-2',
      updatedAt: now
    });
  });
});
