import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Get,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

import { CurrentUser } from '../auth/jwt-auth.guard';
import { UploadService } from './upload.service';
import { CvAssistDto, CvConfirmDto } from './dto/cv-review.dto';

class SignedUrlQueryDto {
  @ApiProperty({ example: 'users/<userId>/picture/<uuid>.webp' })
  @IsString()
  @MaxLength(300)
  @Matches(/^[\w./-]+$/)
  key!: string;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Images are accepted for scanned CVs; the browser (or the optional server OCR) reads them (16.3).
const ALLOWED_CV_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];
const MAX_OCR_FIELD_SIZE = 3 * 1024 * 1024; // OCR words JSON
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
  limits: { fileSize: MAX_CV_SIZE, fieldSize: MAX_OCR_FIELD_SIZE, fields: 2 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_CV_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          'Only PDF, DOCX, JPG and PNG files are accepted for CV uploads',
        ),
        false,
      );
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
        ocr: {
          type: 'string',
          description:
            'Optional JSON array of OCR words {text,x,y,width,height,page} recognised in the browser.',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', cvMulterOptions))
  uploadCv(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('sub') userId: string,
    @Body('ocr') ocr?: string,
  ): Promise<unknown> {
    return this.uploadService.uploadCv(userId, file, ocr);
  }

  @Get('cv/status')
  @ApiOkResponse({
    description: 'Get CV scan status and the parsed CV for review.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  getCvStatus(@CurrentUser('sub') userId: string): Promise<unknown> {
    return this.uploadService.getCvStatus(userId);
  }

  @Post('cv/confirm')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Apply the reviewed CV to the profile (merge).',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  confirmCv(
    @CurrentUser('sub') userId: string,
    @Body() dto: CvConfirmDto,
  ): Promise<unknown> {
    return this.uploadService.confirmCv(userId, dto);
  }

  @Post('cv/assist')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Re-read one CV section with AI (on request only).',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  assistCv(
    @CurrentUser('sub') userId: string,
    @Body() dto: CvAssistDto,
  ): Promise<unknown> {
    return this.uploadService.assistCv(userId, dto.section);
  }

  @Get('url')
  @ApiOkResponse({
    description:
      'Short-lived download URL for one of your own files (private bucket).',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  signedUrl(
    @CurrentUser('sub') userId: string,
    @Query() query: SignedUrlQueryDto,
  ): Promise<{ url: string; expiresAt: string }> {
    return this.uploadService.signedUrl(userId, query.key);
  }
}
