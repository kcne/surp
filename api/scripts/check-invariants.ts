import { PrismaClient } from '@prisma/client';
import { runIncidentFixtures } from './invariant-incident-fixtures';
import { InvariantSeverity } from '../src/invariants/invariant.types';
import { INVARIANTS } from '../src/invariants/registry';
import { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaClient();

type FailOn = InvariantSeverity;

function failOnFromArgs(args: string[]): FailOn {
  const equalsArg = args.find((arg) => arg.startsWith('--fail-on='));
  const flagIndex = args.indexOf('--fail-on');
  const value =
    equalsArg?.slice('--fail-on='.length) ?? (flagIndex >= 0 ? args[flagIndex + 1] : 'critical');

  if (value !== 'critical' && value !== 'warning') {
    throw new Error(`Invalid --fail-on value "${value ?? ''}"; expected critical or warning`);
  }

  return value;
}

function blocksBuild(severity: InvariantSeverity, failOn: FailOn): boolean {
  return failOn === 'warning' || severity === 'critical';
}

async function main() {
  const failOn = failOnFromArgs(process.argv.slice(2));
  const fixtureResults = await runIncidentFixtures(prisma);

  for (const result of fixtureResults) {
    console.log(`fixture PASS  ${result.name} -> ${result.invariantKey}`);
  }

  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      slug: true,
      users: { select: { id: true }, orderBy: { createdAt: 'asc' }, take: 1 }
    },
    orderBy: { slug: 'asc' }
  });

  let blockingViolationCount = 0;
  let totalViolationCount = 0;

  for (const tenant of tenants) {
    const ctx = {
      tenantId: tenant.id,
      actorId: tenant.users[0]?.id ?? 'invariants-ci',
      prisma: prisma as unknown as PrismaService,
      windowDays: 30
    };

    for (const invariant of INVARIANTS) {
      const result = await invariant.check(ctx);
      const count = result.violations.length;
      totalViolationCount += count;

      if (count > 0) {
        const marker = blocksBuild(invariant.severity, failOn) ? 'FAIL' : 'WARN';
        console.log(
          `${marker} ${tenant.slug} ${invariant.key} (${invariant.severity}): ${count} violation(s), ${result.scannedCount} scanned`
        );
        for (const violation of result.violations) {
          console.log(`  - ${violation.subjectType}:${violation.subjectId} ${violation.summary}`);
        }
      }

      if (blocksBuild(invariant.severity, failOn)) {
        blockingViolationCount += count;
      }
    }
  }

  console.log(
    `Checked ${INVARIANTS.length} invariant(s) across ${tenants.length} tenant(s); ${totalViolationCount} violation(s), ${blockingViolationCount} blocking at ${failOn}.`
  );

  if (blockingViolationCount > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
