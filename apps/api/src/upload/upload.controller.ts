import {
  BadRequestException,
  Controller,
  HttpCode,
  Logger,
  Post,
  Get,
  Req,
  Res,
  NotFoundException,
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
import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import type { Request, Response } from 'express';

import { CurrentUser, Public } from '../auth/jwt-auth.guard';
import { UploadService } from './upload.service';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_CV_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_PICTURE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_CV_SIZE = 10 * 1024 * 1024; // 10 MB

const pictureMulterOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_PICTURE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          'Only JPEG, PNG, and WebP images are allowed for profile pictures',
        ),
        false,
      );
    }
  },
};

const cvMulterOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_CV_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_CV_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          'Only PDF and DOCX files are accepted for CV uploads',
        ),
        false,
      );
    }
  },
};

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

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
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.uploadService.uploadPicture(userId, file);
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
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.uploadService.uploadCv(userId, file);
  }

  @Get('cv/status')
  @ApiOkResponse({ description: 'Get CV scan status.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  getCvStatus(@CurrentUser('sub') userId: string): Promise<unknown> {
    return this.uploadService.getCvStatus(userId);
  }

  @Get('file/*')
  @Public()
  @ApiOkResponse({ description: 'Serve an uploaded file from storage.' })
  async serveFile(@Req() req: Request, @Res() res: Response): Promise<void> {
    // req.path is "[/api]/upload/file/<userId>/<TYPE>/<uuid>.<ext>"
    const objectKey = decodeURIComponent(
      req.path.replace(/^.*?\/upload\/file\//, ''),
    );
    if (!objectKey) {
      throw new NotFoundException('File not found');
    }

    try {
      const { stream, contentType } =
        await this.uploadService.getFileStream(objectKey);
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400');
      stream.on('error', (streamErr) => {
        this.logger.warn(`Stored file stream failed: ${String(streamErr)}`);
        res.destroy();
      });
      stream.pipe(res);
    } catch (err) {
      this.logger.warn(`Could not serve stored file: ${String(err)}`);
      throw new NotFoundException('File not found');
    }
  }
}
