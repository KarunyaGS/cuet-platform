-- Figure-identification flashcards keep the image they show. Additive and nullable: every existing card is unchanged.
ALTER TABLE "flashcards" ADD COLUMN "media_asset_id" TEXT;
