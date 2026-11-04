import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common';

const MAX_INT4 = 2_147_483_647;

/**
 * Reads a numeric database id from a URL. Anything that cannot be an id is simply not found, and
 * never reaches the database, where a value too large for the column would be an internal error.
 */
@Injectable()
export class ParseIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const id = /^[1-9]\d{0,9}$/.test(value) ? Number(value) : NaN;
    if (!Number.isInteger(id) || id > MAX_INT4) {
      throw new NotFoundException('Record not found.');
    }
    return id;
  }
}
