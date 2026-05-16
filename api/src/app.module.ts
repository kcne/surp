import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { LinesModule } from './lines/lines.module';
import { MarketingLeadsModule } from './marketing-leads/marketing-leads.module';
import { PassengersModule } from './passengers/passengers.module';
import { PlatformTenantsModule } from './platform-tenants/platform-tenants.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublicStorefrontModule } from './public-storefront/public-storefront.module';
import { ReportingModule } from './reporting/reporting.module';
import { ReservationsModule } from './reservations/reservations.module';
import { RidesModule } from './rides/rides.module';
import { StationsModule } from './stations/stations.module';
import { StorefrontAdminModule } from './storefront-admin/storefront-admin.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100
      }
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    StationsModule,
    LinesModule,
    MarketingLeadsModule,
    PassengersModule,
    PlatformTenantsModule,
    RidesModule,
    ReservationsModule,
    ReportingModule,
    TicketsModule,
    PublicStorefrontModule,
    StorefrontAdminModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
