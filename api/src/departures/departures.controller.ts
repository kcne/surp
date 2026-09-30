import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RequestWithAuth } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { DepartureListResponseDto, DepartureResponseDto } from './dto/departure.response.dto';
import { ListDeparturesQueryDto } from './dto/list-departures.query.dto';
import { DeparturesService } from './departures.service';

@ApiTags('Departures')
@ApiBearerAuth('access-token')
@ApiHeader({
  name: 'X-Tenant-Slug',
  required: true,
  description: 'Tenant slug that must match authenticated token tenant.'
})
@Controller('departures')
export class DeparturesController {
  constructor(private readonly departuresService: DeparturesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DRIVER)
  @ApiOperation({
    summary:
      'List stored departures (one bus on one date) in the current tenant between two service dates. ' +
      'Past, cancelled, dropped and LEGACY departures are included.'
  })
  @ApiOkResponse({ type: DepartureListResponseDto })
  @ApiBadRequestResponse({
    description: 'Validation failure, a date that does not exist, to before from, or a range over 62 days.'
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  list(
    @Req() request: RequestWithAuth,
    @Query() query: ListDeparturesQueryDto
  ): Promise<DepartureListResponseDto> {
    return this.departuresService.list(request.auth!, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DRIVER)
  @ApiOperation({ summary: 'Get one stored departure by id in the current tenant.' })
  @ApiOkResponse({ type: DepartureResponseDto })
  @ApiNotFoundResponse({ description: 'Departure not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getById(@Req() request: RequestWithAuth, @Param('id') id: string): Promise<DepartureResponseDto> {
    return this.departuresService.getById(request.auth!, id);
  }
}
