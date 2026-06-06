import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Get,
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
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

import { UploadService } from './upload.service';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_CV_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_PICTURE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_CV_SIZE = 10 * 1024 * 1024; // 10 MB

const pictureMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: './tmp',
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: MAX_PICTURE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Only JPEG, PNG, and WebP images are allowed for profile pictures'), false);
    }
  },
};

const cvMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: './tmp',
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: MAX_CV_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_CV_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Only PDF and DOCX files are accepted for CV uploads'), false);
    }
  },
};

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
  @UseInterceptors(FileInterceptor('file', pictureMulterOptions))
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
  @UseInterceptors(FileInterceptor('file', cvMulterOptions))
  uploadCv(
    @UploadedFile() file: Express.Multer.File,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.uploadService.uploadCv(authorization, file);
  }

  @Get('cv/status')
  @ApiOkResponse({ description: 'Get CV scan status.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  getCvStatus(
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.uploadService.getCvStatus(authorization);
  }
}
