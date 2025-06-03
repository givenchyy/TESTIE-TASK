"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Users, Crown, Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Team {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

interface TeamSelectorProps {
  selectedTeamId: string | null;
  onTeamChange: (teamId: string | null) => void;
}

export function TeamSelector({
  selectedTeamId,
  onTeamChange,
}: TeamSelectorProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", description: "" });
  const [inviteEmail, setInviteEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tablesExist, setTablesExist] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel("team-members")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_members",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          // payload — имеет тип any, можно типизировать при желании
          fetchTeams();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  useEffect(() => {
    getCurrentUser();
    checkAndCreateTables();
  }, []);

  useEffect(() => {
    if (tablesExist) {
      fetchTeams();
    }
  }, [tablesExist]);

  const getCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const checkAndCreateTables = async () => {
    try {
      // Проверяем существование таблиц
      const { data: tablesData, error: tablesError } = await supabase
        .from("information_schema.tables")
        .select("table_name")
        .eq("table_schema", "public")
        .in("table_name", ["teams", "team_members"]);

      if (tablesError) {
        console.log("Таблицы не существуют, создаем их...");
        await createTables();
      } else if (tablesData && tablesData.length >= 2) {
        setTablesExist(true);
      } else {
        console.log("Не все таблицы существуют, создаем их...");
        await createTables();
      }
    } catch (error) {
      console.log("Ошибка при проверке таблиц, создаем их...");
      await createTables();
    }
  };

  const createTables = async () => {
    try {
      // Создаем таблицы через RPC функцию или прямой SQL
      const { error } = await supabase.rpc("create_tables_if_not_exist");

      if (error) {
        // Если RPC не работает, пробуем создать таблицы напрямую
        console.log("RPC не работает, пропускаем создание таблиц");
        // Для демонстрации просто устанавливаем флаг
        setTablesExist(true);
        return;
      }

      setTablesExist(true);
      toast({
        title: "✅ Таблицы созданы",
        description: "База данных настроена успешно",
      });
    } catch (error) {
      console.error("Ошибка при создании таблиц:", error);
      // Все равно пробуем работать
      setTablesExist(true);
    }
  };

  const fetchTeams = async () => {
    if (!tablesExist) return;

    try {
      // Пробуем получить команды, если таблица не существует - создаем пустой массив
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        if (error.message.includes("does not exist")) {
          console.log("Таблица teams не существует, работаем без команд");
          setTeams([]);
          return;
        }
        throw error;
      }

      setTeams(data || []);
    } catch (error) {
      console.error("Ошибка при загрузке команд:", error);
      // Не показываем ошибку пользователю, просто работаем без команд
      setTeams([]);
    }
  };

  const createTeam = async () => {
    if (!newTeam.name.trim()) return;

    setIsLoading(true);
    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError) throw userError;

      // Пробуем создать команду
      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .insert({
          name: newTeam.name,
          description: newTeam.description || null,
          owner_id: userData.user.id,
        })
        .select()
        .single();

      if (teamError) {
        if (teamError.message.includes("does not exist")) {
          toast({
            title: "⚠️ Функция команд недоступна",
            description: "Работайте с личными задачами",
            variant: "destructive",
          });
          setIsCreateDialogOpen(false);
          return;
        }
        throw teamError;
      }

      // Добавляем создателя как участника команды
      const { error: memberError } = await supabase
        .from("team_members")
        .insert({
          team_id: teamData.id,
          user_id: userData.user.id,
          role: "owner",
        });

      if (memberError && !memberError.message.includes("does not exist")) {
        console.error("Ошибка при добавлении участника:", memberError);
      }

      setTeams((prev) => [teamData, ...prev]);
      setNewTeam({ name: "", description: "" });
      setIsCreateDialogOpen(false);
      onTeamChange(teamData.id);

      toast({
        title: "🎉 Команда создана!",
        description: `Команда "${teamData.name}" успешно создана`,
      });
    } catch (error) {
      console.error("Ошибка при создании команды:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать команду",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendInvitation = async () => {
    if (!inviteEmail || !selectedTeamId) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      toast({
        title: "Ошибка",
        description: "Не удалось определить приглашающего пользователя",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase.from("team_invitations").insert({
      email: inviteEmail,
      team_id: selectedTeamId,
      invited_by: user.email, // <-- добавляем email того, кто приглашает
    });

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось отправить приглашение",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Приглашение отправлено",
      description: `Пользователь с email ${inviteEmail} получит приглашение`,
    });

    setInviteEmail("");
    setIsInviteDialogOpen(false);
  };

  const selectedTeam = teams.find((team) => team.id === selectedTeamId);
  const isOwner = selectedTeam?.owner_id === currentUserId;

  return (
    <div className="flex items-center gap-3">
      <Select
        value={selectedTeamId || "personal"}
        onValueChange={(value) =>
          onTeamChange(value === "personal" ? null : value)
        }
      >
        <SelectTrigger className="w-48 border-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-0 shadow-2xl">
          <SelectItem value="personal">
            <div className="flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Личные задачи
            </div>
          </SelectItem>
          {teams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              <div className="flex items-center">
                {team.owner_id === currentUserId && (
                  <Crown className="w-4 h-4 mr-2 text-yellow-500" />
                )}
                <Users className="w-4 h-4 mr-2" />
                {team.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button className="team-button text-white border-0 rounded-xl px-4 py-2 shadow-lg">
            <Plus className="w-4 h-4 mr-2" />
            Создать команду
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md stat-card border-0 shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              🚀 Новая команда
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="team-name" className="text-sm font-medium">
                Название команды
              </Label>
              <Input
                id="team-name"
                value={newTeam.name}
                onChange={(e) =>
                  setNewTeam((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Введите название команды"
                className="transition-all duration-150 rounded-lg"
              />
            </div>
            <div>
              <Label htmlFor="team-description" className="text-sm font-medium">
                Описание (необязательно)
              </Label>
              <Textarea
                id="team-description"
                value={newTeam.description}
                onChange={(e) =>
                  setNewTeam((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Описание команды"
                className="transition-all duration-150 rounded-lg"
                rows={3}
              />
            </div>
            <Button
              onClick={createTeam}
              className="w-full team-button text-white border-0 rounded-lg py-3"
              disabled={isLoading}
            >
              {isLoading ? "Создание..." : "Создать команду"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedTeamId && isOwner && (
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Mail className="mr-2 h-4 w-4" /> Пригласить в команду
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Пригласить участника</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Label>Email</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <Button
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary hover:bg-primary/90 h-10 w-full md:w-auto bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 rounded-xl py-3 px-6 shadow-lg button-glow transition-all duration-300 hover:shadow-xl "
              onClick={sendInvitation}
              disabled={!inviteEmail}
            >
              Отправить приглашение
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
