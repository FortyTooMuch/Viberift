# 📸 Avatar Upload Setup Guide

The profile page now supports direct image uploads for avatars. To enable this feature, you need to create a storage bucket in Supabase.

## Setup Steps

### 1. Create Storage Bucket

1. Open your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Configure the bucket:
   - Name: `profiles`
   - **Public bucket**: ✅ Check this box (allows public avatar URLs)
   - File size limit: 5MB (default)

### 2. Set Storage Policies

Navigate to **Storage > Policies** and add this policy:

```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload own avatar"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'profiles' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow anyone to read avatar images (public bucket)
CREATE POLICY "Public avatar access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'profiles');
```

### 3. Test Upload

1. Sign in to your app
2. Go to Profile page
3. Click on your avatar or the camera icon
4. Select an image (max 5MB)
5. Avatar should upload and display immediately

## Features

- **Click-to-upload**: Click avatar or camera icon to select file
- **Auto-generated avatars**: Uses DiceBear API for default avatars based on user ID
- **Supported formats**: JPG, PNG, GIF, WebP
- **File size limit**: 5MB max
- **Storage path**: `profiles/avatars/{user_id}/{timestamp}-{filename}`

## Troubleshooting

**Upload fails with 403 error:**
- Check that the storage bucket is set to public
- Verify the storage policies are applied correctly
- Make sure you're signed in

**Avatar doesn't display:**
- Check browser console for errors
- Verify the public URL is accessible
- Try clearing browser cache

**Image too large:**
- Compress image before upload
- Use online tools like TinyPNG or Squoosh
- Recommended: 512x512px or smaller
