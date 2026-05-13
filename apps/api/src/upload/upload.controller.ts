import {
  Controller,
  Headers,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

import { UploadService } from './upload.service';

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('picture')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Upload profile picture.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Profile picture file',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        // We use this as a simple fallback; UploadService will re-upload to MinIO.
        // (In production you should prefer memory storage.)
        destination: './tmp',
        filename: (_req, file, cb) =>
          cb(null, `${Date.now()}-${file.originalname}`),
      }),
    }),
  )
  uploadPicture(
    @UploadedFile() file: Express.Multer.File,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.uploadService.uploadPicture(authorization, file);
  }

  @Post('cv')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Upload CV/resume file.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'CV/resume file',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './tmp',
        filename: (_req, file, cb) =>
          cb(null, `${Date.now()}-${file.originalname}`),
      }),
    }),
  )
  uploadCv(
    @UploadedFile() file: Express.Multer.File,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.uploadService.uploadCv(authorization, file);
  }
}
