import { Global, Module } from '@nestjs/common';
import { OBJECT_STORAGE } from './object-storage';
import { storageFromEnv } from './s3-object-storage';
import { StorageLifecycleService } from './storage-lifecycle.service';

@Global()
@Module({
  providers: [
    { provide: OBJECT_STORAGE, useFactory: storageFromEnv },
    StorageLifecycleService,
  ],
  exports: [OBJECT_STORAGE, StorageLifecycleService],
})
export class StorageModule {}
