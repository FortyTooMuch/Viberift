import { NextApiRequest, NextApiResponse } from 'next';
import supabaseServer from '../../../lib/supabaseServer';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace(/^Bearer\s+/, '') ?? null;
  const { data: userRes } = await supabaseServer.auth.getUser(token ?? '');
  const user = userRes?.user ?? null;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { imageData, fileName } = req.body;
    
    if (!imageData || !fileName) {
      return res.status(400).json({ error: 'Missing image data or filename' });
    }

    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Upload to Supabase Storage
    const filePath = `avatars/${user.id}/${Date.now()}-${fileName}`;
    
    const { data: uploadData, error: uploadError } = await supabaseServer.storage
      .from('profiles')
      .upload(filePath, buffer, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json({ error: uploadError.message });
    }

    // Get public URL
    const { data: publicUrlData } = supabaseServer.storage
      .from('profiles')
      .getPublicUrl(filePath);

    const avatarUrl = publicUrlData.publicUrl;

    // Update user profile
    const { error: updateError } = await supabaseServer
      .from('user_profiles')
      .upsert(
        { user_id: user.id, avatar_url: avatarUrl, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.json({ avatarUrl });
  } catch (err: any) {
    console.error('Upload handler error:', err);
    return res.status(500).json({ error: err?.message ?? 'Server error' });
  }
}
