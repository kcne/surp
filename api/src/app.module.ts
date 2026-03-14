import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { LinesModule } from './lines/lines.module';
import { PassengersModule } from './passengers/passengers.module';
import { PrismaModule } from './prisma/prisma.module';
import { RidesModule } from './rides/rides.module';
import { StationsModule } from './stations/stations.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    StationsModule,
    LinesModule,
    PassengersModule,
    RidesModule
  ]
})
export class AppModule {}
