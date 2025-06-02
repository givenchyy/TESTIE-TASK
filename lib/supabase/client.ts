"use client"

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/lib/database.types"

// Создаем клиент Supabase для использования на стороне клиента
export const createClient = () => {
  return createClientComponentClient<Database>()
}
