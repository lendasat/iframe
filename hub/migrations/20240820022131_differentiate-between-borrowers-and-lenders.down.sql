-- Add down migration script here
ALTER TABLE "borrowers" RENAME TO "users";
