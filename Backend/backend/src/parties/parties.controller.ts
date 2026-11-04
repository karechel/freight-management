import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CurrentUser,
  type Principal,
  RequirePermission,
} from '../auth/auth.decorators.js';
import { ParseIdPipe } from '../common/parse-id.pipe.js';
import {
  CreateContactDto,
  CreatePartyDto,
  ListPartiesQueryDto,
  UpdateContactDto,
  UpdatePartyDto,
} from './parties.dto.js';
import {
  PARTIES_MANAGE,
  PARTIES_VIEW,
  PartiesService,
} from './parties.service.js';

@Controller('parties')
export class PartiesController {
  constructor(private readonly parties: PartiesService) {}

  @RequirePermission(PARTIES_VIEW)
  @Get()
  list(@Query() query: ListPartiesQueryDto, @CurrentUser() user: Principal) {
    return this.parties.list(query, user);
  }

  @RequirePermission(PARTIES_VIEW)
  @Get(':id')
  getOne(@Param('id', ParseIdPipe) id: number, @CurrentUser() user: Principal) {
    return this.parties.getOne(id, user);
  }

  @RequirePermission(PARTIES_MANAGE)
  @Post()
  create(@Body() dto: CreatePartyDto, @CurrentUser() user: Principal) {
    return this.parties.create(dto, user);
  }

  /** Company details need `parties.manage`; billing fields need `parties.billing.manage`. */
  @Patch(':id')
  update(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdatePartyDto,
    @CurrentUser() user: Principal,
  ) {
    return this.parties.update(id, dto, user);
  }

  @RequirePermission(PARTIES_MANAGE)
  @Post(':id/archive')
  @HttpCode(200)
  archive(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser() user: Principal,
  ) {
    return this.parties.archive(id, user);
  }

  @RequirePermission(PARTIES_MANAGE)
  @Post(':id/restore')
  @HttpCode(200)
  restore(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser() user: Principal,
  ) {
    return this.parties.restore(id, user);
  }

  @RequirePermission(PARTIES_MANAGE)
  @Post(':id/contacts')
  addContact(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: CreateContactDto,
    @CurrentUser() user: Principal,
  ) {
    return this.parties.addContact(id, dto, user);
  }

  @RequirePermission(PARTIES_MANAGE)
  @Patch(':id/contacts/:contactId')
  updateContact(
    @Param('id', ParseIdPipe) id: number,
    @Param('contactId', ParseIdPipe) contactId: number,
    @Body() dto: UpdateContactDto,
    @CurrentUser() user: Principal,
  ) {
    return this.parties.updateContact(id, contactId, dto, user);
  }

  @RequirePermission(PARTIES_MANAGE)
  @Delete(':id/contacts/:contactId')
  @HttpCode(204)
  removeContact(
    @Param('id', ParseIdPipe) id: number,
    @Param('contactId', ParseIdPipe) contactId: number,
    @CurrentUser() user: Principal,
  ) {
    return this.parties.removeContact(id, contactId, user);
  }
}
