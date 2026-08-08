import { supabase } from '../../lib/supabase';
import type { BusinessProfile } from '../../lib/types';

export interface BusinessProfileInput {
  name: string;
  address: string | null;
  phone: string | null;
}

/** The single-user business profile, or null if it hasn't been set up yet. */
export async function getBusinessProfile(): Promise<BusinessProfile | null> {
  const { data, error } = await supabase.from('business_profile').select('*').maybeSingle();
  if (error) throw error;
  return data as BusinessProfile | null;
}

/** Upsert-by-existence: one row per user, created on first save. */
export async function saveBusinessProfile(input: BusinessProfileInput): Promise<BusinessProfile> {
  const existing = await getBusinessProfile();
  if (existing) {
    const { data, error } = await supabase
      .from('business_profile')
      .update(input)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data as BusinessProfile;
  }
  const { data, error } = await supabase
    .from('business_profile')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as BusinessProfile;
}
