import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RequestWithAuth } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { CreateRideDto } from './dto/create-ride.dto';
import { ListRideInstancesQueryDto } from './dto/ride-instances.query.dto';
import { ListRidesQueryDto } from './dto/list-rides.query.dto';
import { CreateRideExceptionDto } from './dto/ride-exception.dto';
import { ReplaceRideDaySchedulesDto } from './dto/ride-day-time.dto';
import {
  RideInstancesByDateResponseDto,
  PaginatedRidesResponseDto,
  RideExceptionResponseDto,
  RideResponseDto
} from './dto/ride.response.dto';
import { UpdateRideDto } from './dto/update-ride.dto';
import { WouldBreakReservationsDto } from './dto/would-break-reservations.dto';
import { RidesService } from './rides.service';

@ApiTags('Rides')
@ApiBearerAuth('access-token')
@ApiHeader({
  name: 'X-Tenant-Slug',
  required: true,
  description: 'Tenant slug that must match authenticated token tenant.'
})
@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a ride template in the current tenant.' })
  @ApiOkResponse({ type: RideResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or scheduling rule violation.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  create(@Req() request: RequestWithAuth, @Body() dto: CreateRideDto): Promise<RideResponseDto> {
    return this.ridesService.create(request.auth!, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'List rides in the current tenant.' })
  @ApiOkResponse({ type: PaginatedRidesResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  list(
    @Req() request: RequestWithAuth,
    @Query() query: ListRidesQueryDto
  ): Promise<PaginatedRidesResponseDto> {
    return this.ridesService.list(request.auth!, query);
  }

  @Get('instances')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'List materialized ride instances by date in the current tenant.' })
  @ApiOkResponse({ type: RideInstancesByDateResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  listInstancesByDate(
    @Req() request: RequestWithAuth,
    @Query() query: ListRideInstancesQueryDto
  ): Promise<RideInstancesByDateResponseDto> {
    return this.ridesService.listInstancesByDate(request.auth!, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get a ride template detail by id in the current tenant.' })
  @ApiOkResponse({ type: RideResponseDto })
  @ApiNotFoundResponse({ description: 'Ride not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getById(@Req() request: RequestWithAuth, @Param('id') id: string): Promise<RideResponseDto> {
    return this.ridesService.getById(request.auth!, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update ride fields in the current tenant.' })
  @ApiOkResponse({ type: RideResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or scheduling rule violation.' })
  @ApiNotFoundResponse({ description: 'Ride not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  @ApiConflictResponse({
    type: WouldBreakReservationsDto,
    description:
      'The change would break existing reservations, such as lowering capacity under a seat already sold. Resend with confirmBreakingChange to proceed.'
  })
  update(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: UpdateRideDto
  ): Promise<RideResponseDto> {
    return this.ridesService.update(request.auth!, id, dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Replace ride fields in the current tenant.' })
  @ApiOkResponse({ type: RideResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or scheduling rule violation.' })
  @ApiNotFoundResponse({ description: 'Ride not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  @ApiConflictResponse({
    type: WouldBreakReservationsDto,
    description:
      'The change would break existing reservations, such as lowering capacity under a seat already sold. Resend with confirmBreakingChange to proceed.'
  })
  replace(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: UpdateRideDto
  ): Promise<RideResponseDto> {
    return this.ridesService.update(request.auth!, id, dto);
  }

  @Put(':id/day-times')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Replace recurring ride day schedules in the current tenant.' })
  @ApiOkResponse({ type: RideResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or scheduling rule violation.' })
  @ApiNotFoundResponse({ description: 'Ride not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  replaceDayTimes(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: ReplaceRideDaySchedulesDto
  ): Promise<RideResponseDto> {
    return this.ridesService.replaceDayTimes(request.auth!, id, dto.daySchedules);
  }

  @Post(':id/exceptions')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Add a ride exception (skip/additional) in the current tenant.' })
  @ApiOkResponse({ type: RideExceptionResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or invalid exception combination.' })
  @ApiConflictResponse({ description: 'Duplicate exception for date or conflicting exception type.' })
  @ApiNotFoundResponse({ description: 'Ride not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  addException(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: CreateRideExceptionDto
  ): Promise<RideExceptionResponseDto> {
    return this.ridesService.addException(request.auth!, id, dto);
  }

  @Delete(':id/exceptions/:exceptionId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a ride exception in the current tenant.' })
  @ApiOkResponse({ type: RideExceptionResponseDto })
  @ApiNotFoundResponse({ description: 'Ride or exception not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  removeException(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Param('exceptionId') exceptionId: string
  ): Promise<RideExceptionResponseDto> {
    return this.ridesService.removeException(request.auth!, id, exceptionId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a ride template in the current tenant.' })
  @ApiQuery({
    name: 'cascade',
    required: false,
    description: 'When true, cancels active reservations and deactivates the ride.'
  })
  @ApiOkResponse({ type: RideResponseDto })
  @ApiConflictResponse({ description: 'Ride has active reservations and cascade override is not enabled.' })
  @ApiNotFoundResponse({ description: 'Ride not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  remove(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Query('cascade') cascade?: string
  ): Promise<RideResponseDto> {
    return this.ridesService.remove(request.auth!, id, cascade === 'true' || cascade === '1');
  }
}
