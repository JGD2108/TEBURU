"use client";

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    async function loadTheme() {
      try {
        const { data } = await supabase
          .from('restaurant_settings')
          .select('primary_color')
          .limit(1)
          .single();
          
        if (data && data.primary_color) {
          document.documentElement.style.setProperty('--primary', data.primary_color);
        }
      } catch (error) {
        console.error("Error loading theme:", error);
      }
    }
    loadTheme();
  }, []);

  return <>{children}</>;
}
