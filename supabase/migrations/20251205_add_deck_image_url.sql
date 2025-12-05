-- Add image_url to decks for cover images
alter table decks add column if not exists image_url text;
