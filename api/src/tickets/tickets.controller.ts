import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
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
import { CreateTicketCommentDto } from './dto/create-ticket-comment.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import {
  CompleteTicketAttachmentDto,
  CreateTicketAttachmentPresignDto,
  TicketAttachmentDownloadResponseDto,
  TicketAttachmentPresignResponseDto
} from './dto/ticket-attachment.dto';
import { ListTicketsQueryDto } from './dto/list-tickets.query.dto';
import { PaginatedTicketsResponseDto, TicketResponseDto } from './dto/ticket.response.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketsService } from './tickets.service';

@ApiTags('Tickets')
@ApiBearerAuth('access-token')
@ApiHeader({
  name: 'X-Tenant-Slug',
  required: true,
  description: 'Tenant slug that must match authenticated token tenant.'
})
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Create a support ticket in the current tenant.' })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  create(@Req() request: RequestWithAuth, @Body() dto: CreateTicketDto): Promise<TicketResponseDto> {
    return this.ticketsService.create(request.auth!, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'List support tickets in the current tenant.' })
  @ApiOkResponse({ type: PaginatedTicketsResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  list(
    @Req() request: RequestWithAuth,
    @Query() query: ListTicketsQueryDto
  ): Promise<PaginatedTicketsResponseDto> {
    return this.ticketsService.list(request.auth!, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get support ticket detail by id in the current tenant.' })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiNotFoundResponse({ description: 'Ticket not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getById(@Req() request: RequestWithAuth, @Param('id') id: string): Promise<TicketResponseDto> {
    return this.ticketsService.getById(request.auth!, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update support ticket fields in the current tenant.' })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or invalid status transition.' })
  @ApiNotFoundResponse({ description: 'Ticket not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  update(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto
  ): Promise<TicketResponseDto> {
    return this.ticketsService.update(request.auth!, id, dto);
  }

  @Post(':id/comments')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Add a ticket comment in the current tenant.' })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiNotFoundResponse({ description: 'Ticket not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  addComment(
    @Req() request: RequestWithAuth,
    @Param('id') ticketId: string,
    @Body() dto: CreateTicketCommentDto
  ): Promise<TicketResponseDto> {
    return this.ticketsService.addComment(request.auth!, ticketId, dto);
  }

  @Post(':id/attachments/presign-upload')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Create signed upload URL for a ticket attachment image.' })
  @ApiOkResponse({ type: TicketAttachmentPresignResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or invalid image metadata.' })
  @ApiNotFoundResponse({ description: 'Ticket not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  presignUpload(
    @Req() request: RequestWithAuth,
    @Param('id') ticketId: string,
    @Body() dto: CreateTicketAttachmentPresignDto
  ): Promise<TicketAttachmentPresignResponseDto> {
    return this.ticketsService.presignUpload(
      request.auth!,
      ticketId,
      dto.fileName,
      dto.mimeType,
      dto.sizeBytes
    );
  }

  @Post(':id/attachments/complete')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Persist uploaded ticket-level attachment metadata.' })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or invalid storage key context.' })
  @ApiConflictResponse({ description: 'Attachment key already recorded.' })
  @ApiNotFoundResponse({ description: 'Ticket not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  completeAttachment(
    @Req() request: RequestWithAuth,
    @Param('id') ticketId: string,
    @Body() dto: CompleteTicketAttachmentDto
  ): Promise<TicketResponseDto> {
    return this.ticketsService.completeAttachment(request.auth!, ticketId, dto);
  }

  @Post(':id/comments/:commentId/attachments/complete')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Persist uploaded comment-level attachment metadata.' })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or invalid storage key context.' })
  @ApiConflictResponse({ description: 'Attachment key already recorded.' })
  @ApiNotFoundResponse({ description: 'Ticket or comment not found in current tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  completeCommentAttachment(
    @Req() request: RequestWithAuth,
    @Param('id') ticketId: string,
    @Param('commentId') commentId: string,
    @Body() dto: CompleteTicketAttachmentDto
  ): Promise<TicketResponseDto> {
    return this.ticketsService.completeAttachment(request.auth!, ticketId, dto, commentId);
  }

  @Get(':id/attachments/:attachmentId/presign-download')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Create signed download URL for a tenant ticket attachment image.' })
  @ApiOkResponse({ type: TicketAttachmentDownloadResponseDto })
  @ApiNotFoundResponse({ description: 'Attachment not found in current tenant ticket.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  presignDownload(
    @Req() request: RequestWithAuth,
    @Param('id') ticketId: string,
    @Param('attachmentId') attachmentId: string
  ): Promise<TicketAttachmentDownloadResponseDto> {
    return this.ticketsService.getAttachmentDownloadUrl(request.auth!, ticketId, attachmentId);
  }
}
