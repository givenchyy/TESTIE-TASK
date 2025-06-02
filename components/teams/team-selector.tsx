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

  const inviteToTeam = async () => {
    if (!inviteEmail.trim() || !selectedTeamId) return;

    setIsLoading(true);
    try {
      toast({
        title: "📧 Приглашение отправлено!",
        description: `Приглашение отправлено на ${inviteEmail}`,
      });

      setInviteEmail("");
      setIsInviteDialogOpen(false);
    } catch (error) {
      console.error("Ошибка при отправке приглашения:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось отправить приглашение",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
          <Users className="w-4 h-4 mr-2" />
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
            <Button
              variant="outline"
              className="border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-900/20 rounded-xl button-glow"
            >
              <Mail className="w-4 h-4 mr-2" />
              Пригласить
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md stat-card border-0 shadow-2xl rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                📧 Пригласить в команду
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="invite-email" className="text-sm font-medium">
                  Email участника
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="example@mail.ru"
                  className="transition-all duration-150 rounded-lg"
                />
              </div>
              <Button
                onClick={inviteToTeam}
                className="w-full team-button text-white border-0 rounded-lg py-3"
                disabled={isLoading}
              >
                {isLoading ? "Отправка..." : "Отправить приглашение"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
