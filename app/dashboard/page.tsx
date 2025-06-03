"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PendingInvitesBanner } from "@/components/ui/PendingInvitesBanner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TeamSelector } from "@/components/teams/team-selector";
import {
  Plus,
  Edit,
  Trash2,
  Calendar,
  Flag,
  Filter,
  Loader2,
  Search,
  Target,
  Clock,
  Award,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  priority: "low" | "medium" | "high";
  category: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  team_id: string | null;
  user_id: string;
}

interface Invite {
  id: string;
  team_id: string;
  team_name: string;
  invited_by: string;
  status: "pending" | "accepted" | "rejected";
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as const,
    category: "",
    due_date: "",
  });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tablesExist, setTablesExist] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAndCreateTasksTable();
  }, []);

  useEffect(() => {
    if (tablesExist) {
      fetchTasks();
    }
  }, [selectedTeamId, tablesExist]);

  const checkAndCreateTasksTable = async () => {
    try {
      // Пробуем выполнить простой запрос к таблице tasks
      const { data, error } = await supabase
        .from("tasks")
        .select("id")
        .limit(1);

      if (error && error.message.includes("does not exist")) {
        console.log("Таблица tasks не существует, работаем в режиме демо");
        // Создаем демо-данные в localStorage
        createDemoTasks();
      } else {
        setTablesExist(true);
      }
    } catch (error) {
      console.log("Ошибка при проверке таблицы tasks, работаем в режиме демо");
      createDemoTasks();
    }
  };

  const fetchPendingInvites = async () => {
    const { data, error } = await supabase
      .from("team_invitations")
      .select(
        `
    id,
    team_id,
    invited_by,
    status,
    teams!fk_team (
      name
    )
  `
      )
      .eq("status", "pending");

    if (error) {
      console.error("Ошибка загрузки приглашений", error);
    } else {
      const invitesWithTeamName = data.map((invite) => ({
        ...invite,
        team_name: invite.teams?.[0]?.name,
      }));
      setPendingInvites(invitesWithTeamName);
    }
  };
  useEffect(() => {
    if (tablesExist) {
      fetchTasks();
      fetchPendingInvites(); // <- вызов функции загрузки приглашений
    }
  }, [selectedTeamId, tablesExist]);
  const createDemoTasks = () => {
    const demoTasks: Task[] = [
      {
        id: "1",
        title: "Изучить React",
        description: "Пройти курс по React и создать первое приложение",
        completed: false,
        priority: "high",
        category: "Обучение",
        due_date: "2024-02-15",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        team_id: null,
        user_id: "demo-user",
      },
      {
        id: "2",
        title: "Настроить проект",
        description: "Настроить базу данных и деплой",
        completed: true,
        priority: "medium",
        category: "Разработка",
        due_date: "2024-02-10",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        team_id: null,
        user_id: "demo-user",
      },
    ];

    setTasks(demoTasks);
    setFilteredTasks(demoTasks);
    setTablesExist(true);
    setIsLoading(false);

    toast({
      title: "🎯 Демо режим",
      description:
        "Работаем с демо-данными. Настройте базу данных для полной функциональности.",
    });
  };

  // Фильтрация задач
  useEffect(() => {
    let filtered = tasks;

    // Применение фильтра по статусу
    if (filter === "completed") {
      filtered = filtered.filter((task) => task.completed);
    } else if (filter === "pending") {
      filtered = filtered.filter((task) => !task.completed);
    } else if (filter === "high-priority") {
      filtered = filtered.filter((task) => task.priority === "high");
    }

    // Применение поиска
    if (searchTerm) {
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (task.description &&
            task.description
              .toLowerCase()
              .includes(searchTerm.toLowerCase())) ||
          task.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredTasks(filtered);
  }, [tasks, filter, searchTerm]);

  // Загрузка задач из Supabase или localStorage
  const fetchTasks = async () => {
    if (!tablesExist) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (selectedTeamId) {
        query = query.eq("team_id", selectedTeamId);
      } else {
        query = query.is("team_id", null);
      }

      const { data, error } = await query;

      if (error) {
        if (error.message.includes("does not exist")) {
          // Работаем с демо-данными
          return;
        }
        throw error;
      }

      setTasks(data || []);
      setFilteredTasks(data || []);
    } catch (error) {
      console.error("Ошибка при загрузке задач:", error);
      // Не показываем ошибку, работаем с демо-данными
    } finally {
      setIsLoading(false);
    }
  };

  // Добавление новой задачи
  const addTask = async () => {
    if (!newTask.title.trim()) return;

    setIsSubmitting(true);
    try {
      const newTaskData: Task = {
        id: Date.now().toString(),
        user_id: "demo-user",
        title: newTask.title,
        description: newTask.description || null,
        completed: false,
        priority: newTask.priority,
        category: newTask.category || "Общие",
        due_date: newTask.due_date || null,
        team_id: selectedTeamId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (tablesExist) {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError) throw userError;

        const { data, error } = await supabase
          .from("tasks")
          .insert({
            user_id: userData.user.id,
            title: newTask.title,
            description: newTask.description || null,
            completed: false,
            priority: newTask.priority,
            category: newTask.category || "Общие",
            due_date: newTask.due_date || null,
            team_id: selectedTeamId,
          })
          .select();

        if (error) throw error;
        setTasks((prev) => [data[0], ...prev]);
      } else {
        // Работаем с демо-данными
        setTasks((prev) => [newTaskData, ...prev]);
      }

      setNewTask({
        title: "",
        description: "",
        priority: "medium",
        category: "",
        due_date: "",
      });
      setIsAddDialogOpen(false);
      toast({
        title: "✨ Успешно",
        description: "Задача добавлена",
      });
    } catch (error) {
      console.error("Ошибка при добавлении задачи:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось добавить задачу",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Переключение статуса задачи
  const toggleTask = async (id: string, completed: boolean) => {
    try {
      if (tablesExist) {
        const { error } = await supabase
          .from("tasks")
          .update({ completed: !completed })
          .eq("id", id);
        if (error) throw error;
      }

      setTasks((prev) =>
        prev.map((task) =>
          task.id === id ? { ...task, completed: !completed } : task
        )
      );

      if (!completed) {
        toast({
          title: "🎉 Отлично!",
          description: "Задача выполнена",
        });
      }
    } catch (error) {
      console.error("Ошибка при обновлении статуса задачи:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус задачи",
        variant: "destructive",
      });
    }
  };

  // Удаление задачи
  const deleteTask = async (id: string) => {
    try {
      if (tablesExist) {
        const { error } = await supabase.from("tasks").delete().eq("id", id);
        if (error) throw error;
      }

      setTasks((prev) => prev.filter((task) => task.id !== id));
      toast({
        title: "🗑️ Удалено",
        description: "Задача удалена",
      });
    } catch (error) {
      console.error("Ошибка при удалении задачи:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить задачу",
        variant: "destructive",
      });
    }
  };

  // Начало редактирования задачи
  const startEdit = (task: Task) => {
    setEditingTask(task);
    setIsEditDialogOpen(true);
  };

  // Сохранение отредактированной задачи
  const saveEdit = async () => {
    if (!editingTask) return;

    setIsSubmitting(true);
    try {
      if (tablesExist) {
        const { error } = await supabase
          .from("tasks")
          .update({
            title: editingTask.title,
            description: editingTask.description,
            priority: editingTask.priority,
            category: editingTask.category,
            due_date: editingTask.due_date,
          })
          .eq("id", editingTask.id);

        if (error) throw error;
      }

      setTasks((prev) =>
        prev.map((task) => (task.id === editingTask.id ? editingTask : task))
      );
      setEditingTask(null);
      setIsEditDialogOpen(false);
      toast({
        title: "✨ Обновлено",
        description: "Задача обновлена",
      });
    } catch (error) {
      console.error("Ошибка при обновлении задачи:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить задачу",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Получение цвета приоритета
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "priority-high";
      case "medium":
        return "priority-medium";
      case "low":
        return "priority-low";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Получение текста приоритета
  const getPriorityText = (priority: string) => {
    switch (priority) {
      case "high":
        return "Высокий";
      case "medium":
        return "Средний";
      case "low":
        return "Низкий";
      default:
        return "Средний";
    }
  };

  // Получение статистики задач
  const getTaskStats = () => {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.completed).length;
    const pending = total - completed;
    const highPriority = tasks.filter(
      (task) => task.priority === "high" && !task.completed
    ).length;

    return { total, completed, pending, highPriority };
  };

  const stats = getTaskStats();

  // Форматирование даты
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("ru-RU");
  };

  return (
    <div className="space-y-8">
      <div>
        {/* Вот здесь показываем баннер приглашений */}
        <PendingInvitesBanner />

        {/* Дальше весь остальной UI */}
        {/* ... */}
      </div>
      {/* Hero Section */}
      <div className="text-center py-6">
        <div className="inline-flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-600 rounded-xl flex items-center justify-center floating pulse-glow">
            <Target className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 dark:from-purple-400 dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
            Ваши Задачи
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-300 text-lg">
          Управляйте своим временем эффективно
        </p>
      </div>

      {/* Team Selector */}
      <div className="flex justify-center">
        <TeamSelector
          selectedTeamId={selectedTeamId}
          onTeamChange={setSelectedTeamId}
        />
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="stat-card rounded-2xl p-6 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                Всего задач
              </p>
              <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                {stats.total}
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 icon-glow">
              <Target className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card rounded-2xl p-6 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                Выполнено
              </p>
              <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                {stats.completed}
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 icon-glow">
              <Award className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card rounded-2xl p-6 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                В процессе
              </p>
              <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                {stats.pending}
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 icon-glow">
              <Clock className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card rounded-2xl p-6 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                Высокий приоритет
              </p>
              <p className="text-3xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
                {stats.highPriority}
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-rose-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 icon-glow">
              <Flag className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Элементы управления */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Поиск задач..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full py-3 rounded-xl border-0 bg-white/80 backdrop-blur-sm shadow-lg search-glow transition-all duration-300 focus:bg-white"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full md:w-48 rounded-xl border-0 bg-white/80 backdrop-blur-sm shadow-lg py-3">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-0 shadow-2xl">
            <SelectItem value="all">Все задачи</SelectItem>
            <SelectItem value="pending">В процессе</SelectItem>
            <SelectItem value="completed">Выполненные</SelectItem>
            <SelectItem value="high-priority">Высокий приоритет</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full md:w-auto bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 rounded-xl py-3 px-6 shadow-lg button-glow transition-all duration-300 hover:shadow-xl hover:scale-105">
              <Plus className="w-4 h-4 mr-2" />
              Добавить задачу
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl border-0 shadow-2xl bg-white/95 backdrop-blur-sm">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Новая задача
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label
                  htmlFor="title"
                  className="text-sm font-medium text-gray-700"
                >
                  Название
                </Label>
                <Input
                  id="title"
                  value={newTask.title}
                  onChange={(e) =>
                    setNewTask((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Введите название задачи"
                  className="mt-1 rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <Label
                  htmlFor="description"
                  className="text-sm font-medium text-gray-700"
                >
                  Описание
                </Label>
                <Textarea
                  id="description"
                  value={newTask.description}
                  onChange={(e) =>
                    setNewTask((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Описание задачи (необязательно)"
                  className="mt-1 rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor="priority"
                    className="text-sm font-medium text-gray-700"
                  >
                    Приоритет
                  </Label>
                  <Select
                    value={newTask.priority}
                    onValueChange={(value: any) =>
                      setNewTask((prev) => ({ ...prev, priority: value }))
                    }
                  >
                    <SelectTrigger className="mt-1 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      <SelectItem value="low">Низкий</SelectItem>
                      <SelectItem value="medium">Средний</SelectItem>
                      <SelectItem value="high">Высокий</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label
                    htmlFor="category"
                    className="text-sm font-medium text-gray-700"
                  >
                    Категория
                  </Label>
                  <Input
                    id="category"
                    value={newTask.category}
                    onChange={(e) =>
                      setNewTask((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                    placeholder="Категория"
                    className="mt-1 rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <Label
                  htmlFor="dueDate"
                  className="text-sm font-medium text-gray-700"
                >
                  Срок выполнения
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) =>
                    setNewTask((prev) => ({
                      ...prev,
                      due_date: e.target.value,
                    }))
                  }
                  className="mt-1 rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <Button
                onClick={addTask}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 rounded-lg py-3 button-glow transition-all duration-300"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Создание...
                  </>
                ) : (
                  "Создать задачу"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Список задач */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            <div className="absolute inset-0 h-12 w-12 animate-ping rounded-full bg-blue-400 opacity-20"></div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <Card className="task-card rounded-2xl border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-4 floating">
                  <Calendar className="w-8 h-8 text-gray-500" />
                </div>
                <p className="text-gray-500 text-lg font-medium">
                  Задачи не найдены
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {tasks.length === 0
                    ? "Создайте свою первую задачу"
                    : "Попробуйте изменить фильтры поиска"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredTasks.map((task) => (
              <Card
                key={task.id}
                className={`task-card rounded-2xl border-0 shadow-lg bg-white/90 backdrop-blur-sm transition-all duration-300 ${
                  task.completed ? "opacity-75" : ""
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <Checkbox
                        checked={task.completed}
                        onCheckedChange={() =>
                          toggleTask(task.id, task.completed)
                        }
                        className="mt-1 w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-green-500 data-[state=checked]:to-emerald-500 data-[state=checked]:border-0"
                      />
                      {task.completed && (
                        <div className="absolute inset-0 w-5 h-5 rounded-md bg-gradient-to-r from-green-500 to-emerald-500 animate-pulse"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3
                            className={`font-semibold text-lg ${
                              task.completed
                                ? "line-through text-gray-500"
                                : "text-gray-900 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent"
                            }`}
                          >
                            {task.title}
                          </h3>
                          {task.description && (
                            <p
                              className={`text-sm mt-2 ${
                                task.completed
                                  ? "text-gray-400"
                                  : "text-gray-600"
                              }`}
                            >
                              {task.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            <Badge
                              className={`${getPriorityColor(
                                task.priority
                              )} font-medium px-3 py-1 rounded-full`}
                            >
                              {getPriorityText(task.priority)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-700 font-medium px-3 py-1 rounded-full"
                            >
                              {task.category}
                            </Badge>
                            {task.due_date && (
                              <Badge
                                variant="outline"
                                className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 text-purple-700 font-medium px-3 py-1 rounded-full"
                              >
                                <Calendar className="w-3 h-3 mr-1" />
                                {formatDate(task.due_date)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(task)}
                            className="rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 button-glow"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTask(task.id)}
                            className="rounded-lg hover:bg-red-50 hover:text-red-600 transition-all duration-200 button-glow"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Диалог редактирования */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-0 shadow-2xl bg-white/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Редактировать задачу
            </DialogTitle>
          </DialogHeader>
          {editingTask && (
            <div className="space-y-4">
              <div>
                <Label
                  htmlFor="edit-title"
                  className="text-sm font-medium text-gray-700"
                >
                  Название
                </Label>
                <Input
                  id="edit-title"
                  value={editingTask.title}
                  onChange={(e) =>
                    setEditingTask((prev) =>
                      prev ? { ...prev, title: e.target.value } : null
                    )
                  }
                  className="mt-1 rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <Label
                  htmlFor="edit-description"
                  className="text-sm font-medium text-gray-700"
                >
                  Описание
                </Label>
                <Textarea
                  id="edit-description"
                  value={editingTask.description || ""}
                  onChange={(e) =>
                    setEditingTask((prev) =>
                      prev ? { ...prev, description: e.target.value } : null
                    )
                  }
                  className="mt-1 rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor="edit-priority"
                    className="text-sm font-medium text-gray-700"
                  >
                    Приоритет
                  </Label>
                  <Select
                    value={editingTask.priority}
                    onValueChange={(value: any) =>
                      setEditingTask((prev) =>
                        prev ? { ...prev, priority: value } : null
                      )
                    }
                  >
                    <SelectTrigger className="mt-1 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      <SelectItem value="low">Низкий</SelectItem>
                      <SelectItem value="medium">Средний</SelectItem>
                      <SelectItem value="high">Высокий</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label
                    htmlFor="edit-category"
                    className="text-sm font-medium text-gray-700"
                  >
                    Категория
                  </Label>
                  <Input
                    id="edit-category"
                    value={editingTask.category}
                    onChange={(e) =>
                      setEditingTask((prev) =>
                        prev ? { ...prev, category: e.target.value } : null
                      )
                    }
                    className="mt-1 rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <Label
                  htmlFor="edit-dueDate"
                  className="text-sm font-medium text-gray-700"
                >
                  Срок выполнения
                </Label>
                <Input
                  id="edit-dueDate"
                  type="date"
                  value={editingTask.due_date || ""}
                  onChange={(e) =>
                    setEditingTask((prev) =>
                      prev ? { ...prev, due_date: e.target.value } : null
                    )
                  }
                  className="mt-1 rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <Button
                onClick={saveEdit}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 rounded-lg py-3 button-glow transition-all duration-300"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  "Сохранить изменения"
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
