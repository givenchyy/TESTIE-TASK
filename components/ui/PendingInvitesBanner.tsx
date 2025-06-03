"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export function PendingInvitesBanner() {
  const [invites, setInvites] = useState<any[]>([]);
  const supabase = createClient();
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  useEffect(() => {
    const fetchInvites = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data, error } = await supabase
        .from("team_invitations")
        .select(
          `
    id,
    team_id,
    invited_by,
    status,
    teams!team_invitations_team_id_fkey (
      name
    )
        `
        )
        .eq("email", user.email)
        .eq("status", "pending");

      if (error) {
        console.error("Ошибка при получении приглашений:", error);
        return;
      }

      if (data?.length > 0) setInvites(data);
    };

    fetchInvites();
  }, []);

  const handleAccept = async (inviteId: string) => {
    setLoadingId(inviteId);
    try {
      const invite = invites.find((i) => i.id === inviteId);
      if (!invite) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Обновляем статус приглашения
      const { error: updateError } = await supabase
        .from("team_invitations")
        .update({ status: "accepted" })
        .eq("id", inviteId);

      if (updateError) throw updateError;

      // 2. Добавляем юзера в команду
      const { error: insertError } = await supabase
        .from("team_members")
        .insert({
          team_id: invite.team_id,
          user_id: user.id,
          role: "member",
        });

      if (insertError) throw insertError;

      toast({
        title: "Принято",
        description: "Вы успешно присоединились к команде.",
      });

      setInvites((prev) => prev.filter((i) => i.id !== inviteId));

      await router.refresh();
    } catch (error) {
      toast({
        title: "Ошибка",
        description:
          (error as any).message || "Не удалось принять приглашение.",
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (inviteId: string) => {
    const { error } = await supabase
      .from("team_invitations")
      .update({ status: "declined" })
      .eq("id", inviteId);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось отклонить приглашение.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Отклонено",
        description: "Вы отклонили приглашение.",
      });
      setInvites(invites.filter((i) => i.id !== inviteId));
    }
  };

  if (invites.length === 0) return null;

  return (
    <div className="p-4 bg-yellow-100 text-yellow-900 rounded-lg shadow mb-4 max-w-md">
      <div className="mb-2 font-semibold">
        У вас есть {invites.length} приглашение(й) в команду:
      </div>
      {invites.map((invite) => (
        <div
          key={invite.id}
          className="mb-3 p-3 bg-yellow-50 rounded border border-yellow-300 flex flex-col space-y-2"
        >
          <div>
            Пригласил: <i>{invite.invited_by || "Неизвестно"}</i>
          </div>
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReject(invite.id)}
            >
              Отклонить
            </Button>
            <Button
              size="sm"
              onClick={() => handleAccept(invite.id)}
              disabled={loadingId === invite.id}
            >
              {loadingId === invite.id ? "Принятие..." : "Принять"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
