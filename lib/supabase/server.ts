import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import type { Database } from "@/lib/database.types"

// Создаем клиент Supabase для использования на стороне сервера
export const createClient = () => {
  return createServerComponentClient<Database>({ cookies })
}
