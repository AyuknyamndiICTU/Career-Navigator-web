-- CV review step (16.7): parsed CVs are applied to the profile only after the user confirms them.
ALTER TABLE "UploadMedia" ADD COLUMN "cvConfirmedAt" TIMESTAMP(3);
