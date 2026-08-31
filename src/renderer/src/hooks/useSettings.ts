import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { SkillAppSettings } from '../lib/types';

interface SettingsRow {
  user_id: string;
  reminder_threshold_days: number;
  notifications_enabled: boolean;
  auto_launch_enabled: boolean;
}

function fromRow(row: SettingsRow): SkillAppSettings {
  return {
    userId: row.user_id,
    reminderThresholdDays: row.reminder_threshold_days,
    notificationsEnabled: row.notifications_enabled,
    autoLaunchEnabled: row.auto_launch_enabled,
  };
}

function toRow(patch: Partial<Omit<SkillAppSettings, 'userId'>>) {
  return {
    ...(patch.reminderThresholdDays !== undefined ? { reminder_threshold_days: patch.reminderThresholdDays } : {}),
    ...(patch.notificationsEnabled !== undefined ? { notifications_enabled: patch.notificationsEnabled } : {}),
    ...(patch.autoLaunchEnabled !== undefined ? { auto_launch_enabled: patch.autoLaunchEnabled } : {}),
  };
}

const DEFAULT_SETTINGS: Omit<SkillAppSettings, 'userId'> = {
  reminderThresholdDays: 5,
  notificationsEnabled: true,
  autoLaunchEnabled: true,
};

export function useSettings() {
  const { session } = useAuth();
  const [settings, setSettings] = useState<SkillAppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const supabase = getSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from('skill_app_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    if (data) {
      setSettings(fromRow(data as SettingsRow));
      setLoading(false);
      return;
    }
    // Première visite : crée la ligne de réglages avec les valeurs par défaut.
    const { data: created, error: insertError } = await supabase
      .from('skill_app_settings')
      .insert({ user_id: session.user.id, ...toRow(DEFAULT_SETTINGS) })
      .select('*')
      .single();
    if (insertError) {
      // Code '23505' = unique violation, peut arriver si React.StrictMode
      // double-invoque l'effet en dev. Une autre invocation a créé la ligne,
      // on la relit simplement.
      if (insertError.code === '23505') {
        const { data: existing, error: refetchError } = await supabase
          .from('skill_app_settings')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (existing) {
          setSettings(fromRow(existing as SettingsRow));
        } else if (refetchError) {
          setError(refetchError.message);
        }
      } else {
        setError(insertError.message);
      }
    } else {
      setSettings(fromRow(created as SettingsRow));
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function updateSettings(patch: Partial<Omit<SkillAppSettings, 'userId'>>) {
    if (!session) return { error: 'Non connecté' };
    const { error: updateError } = await getSupabaseClient()
      .from('skill_app_settings')
      .update(toRow(patch))
      .eq('user_id', session.user.id);
    if (updateError) return { error: updateError.message };
    await refresh();
    return { error: null };
  }

  return { settings, loading, error, refresh, updateSettings };
}
