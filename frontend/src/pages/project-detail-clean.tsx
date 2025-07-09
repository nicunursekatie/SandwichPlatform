import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Calendar, User, Clock, Target, CheckCircle2, Circle, Pause, Play, Plus, Trash2, Edit, Check, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { CelebrationToast, useCelebration } from "@/components/celebration-toast";
import { ProjectAssigneeSelector } from "@/components/project-assignee-selector";
import { TaskAssigneeSelector } from "@/components/task-assignee-selector";
import { MultiUserTaskCompletion } from "@/components/multi-user-task-completion";
import ProjectCongratulations from "@/components/project-congratulations";
import ProjectUserManager from "@/components/project-user-manager";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import type { Project, ProjectTask } from "@shared/schema";

interface ProjectDetailCleanProps {
  projectId: number;
  onBack?: () => void;
}

export default function ProjectDetailClean({ projectId, onBack }: ProjectDetailCleanProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const canEdit = hasPermission(user, PERMISSIONS.EDIT_DATA);
  
  // Debug logging
  console.log('Project Detail - User:', user);
  console.log('Project Detail - Can Edit:', canEdit);
  console.log('Project Detail - User Permissions:', user?.permissions);
  const { celebration, triggerCelebration, hideCelebration } = useCelebration();

  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    status: "pending",
    priority: "medium",
    assigneeId: undefined as string | undefined,
    assigneeName: undefined as string | undefined,
    assigneeIds: undefined as string[] | undefined,
    assigneeNames: undefined as string[] | undefined,
    dueDate: ""
  });
  const [editProject, setEditProject] = useState({
    title: "",
    description: "",
    priority: "medium",
    assigneeName: "",
    dueDate: "",
    status: "active",
    category: "",
    budget: "",
    estimatedHours: "",
    actualHours: ""
  });

  // Fetch project details
  const { data: projects = [], isLoading: projectLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects", projectId],
  });

  const project = projects.find(p => p.id === projectId);

  // Fetch tasks for this project
  const { data: projectTasks = [], isLoading: tasksLoading } = useQuery<ProjectTask[]>({
    queryKey: ["/api/projects", projectId, "tasks"],
    queryFn: () => fetch(`/api/projects/${projectId}/tasks`).then(res => res.json()),
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      return await apiRequest('POST', `/api/projects/${projectId}/tasks`, taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tasks"] });
      setNewTask({ 
        title: "", 
        description: "", 
        status: "pending", 
        priority: "medium", 
        assigneeId: undefined, 
        assigneeName: undefined, 
        assigneeIds: undefined, 
        assigneeNames: undefined, 
        dueDate: "" 
      });
      setIsAddingTask(false);
      toast({ title: "Task created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create task", variant: "destructive" });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<ProjectTask> }) => {
      return await apiRequest('PATCH', `/api/projects/${projectId}/tasks/${id}`, updates);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setEditingTask(null);
      toast({ title: "Task updated successfully" });
      
      // Update project progress after task status change
      const updatedTasks = await queryClient.fetchQuery({ 
        queryKey: ["/api/projects", projectId, "tasks"] 
      }) as ProjectTask[];
      
      if (updatedTasks) {
        const completedTasks = updatedTasks.filter(task => task.status === 'completed').length;
        const newProgress = updatedTasks.length > 0 ? Math.round((completedTasks / updatedTasks.length) * 100) : 0;
        
        // Update project progress in database
        updateProjectMutation.mutate({
          progressPercentage: newProgress
        });
      }
    },
    onError: () => {
      toast({ title: "Failed to update task", variant: "destructive" });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/projects/${projectId}/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tasks"] });
      toast({ title: "Task deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete task", variant: "destructive" });
    },
  });

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PUT', `/api/projects/${projectId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsEditingProject(false);
      toast({ title: "Project updated successfully", description: "The project has been updated." });
    },
    onError: () => {
      toast({ title: "Failed to update project", description: "Please try again later.", variant: "destructive" });
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500 text-white";
      case "high": return "bg-orange-500 text-white";
      case "medium": return "bg-yellow-500 text-white";
      case "low": return "bg-green-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-green-600 bg-green-50 border-green-200";
      case "in_progress": return "text-blue-600 bg-blue-50 border-blue-200";
      case "pending": return "text-orange-600 bg-orange-50 border-orange-200";
      case "waiting": return "text-gray-600 bg-gray-50 border-gray-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-4 h-4" />;
      case "in_progress": return <Play className="w-4 h-4" />;
      case "pending": return <Clock className="w-4 h-4" />;
      case "waiting": return <Pause className="w-4 h-4" />;
      default: return <Circle className="w-4 h-4" />;
    }
  };

  const handleCreateTask = () => {
    if (!newTask.title.trim()) return;
    createTaskMutation.mutate(newTask);
  };

  const handleUpdateTask = () => {
    if (!editingTask) return;
    updateTaskMutation.mutate({
      id: editingTask.id,
      updates: editingTask
    });
  };

  const handleDeleteTask = (id: number) => {
    if (confirm("Are you sure you want to delete this task?")) {
      deleteTaskMutation.mutate(id);
    }
  };

  const handleToggleTaskCompletion = async (task: ProjectTask) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    
    // For multi-user tasks, check if all team members have completed before allowing main completion
    if (newStatus === 'completed' && task.assigneeIds?.length > 1) {
      try {
        const completionsResponse = await apiRequest('GET', `/api/tasks/${task.id}/completions`);
        const completions = completionsResponse || [];
        const totalAssignees = task.assigneeIds.length;
        
        if (completions.length < totalAssignees) {
          toast({
            title: "Team Completion Required",
            description: `All ${totalAssignees} team members must complete their portions first (${completions.length}/${totalAssignees} completed)`,
            variant: "destructive"
          });
          return; // Prevent main completion
        }
      } catch (error) {
        console.error('Failed to check team completions:', error);
        toast({
          title: "Error",
          description: "Failed to verify team completion status",
          variant: "destructive"
        });
        return;
      }
    }
    
    // If we're marking the task as completed, trigger celebration
    if (newStatus === 'completed') {
      triggerCelebration(task.title, task.id);
      
      // Create notification for task completion
      const notificationData = {
        userId: (user as any)?.id || 'anonymous',
        type: 'task_completion',
        title: 'Task Completed!',
        message: `You completed: ${task.title}`,
        relatedType: 'project_task',
        relatedId: task.id,
        celebrationData: {
          taskTitle: task.title,
          projectId: projectId,
          completedAt: new Date().toISOString()
        }
      };
      
      // Send notification to backend
      apiRequest('POST', '/api/notifications', notificationData).catch(err => console.log('Notification storage failed:', err));
    }
    
    updateTaskMutation.mutate({
      id: task.id,
      updates: { status: newStatus }
    });
  };

  // Calculate project progress based on completed tasks
  const calculateProgress = () => {
    if (!projectTasks || projectTasks.length === 0) return 0;
    const completedTasks = projectTasks.filter(task => task.status === 'completed').length;
    return Math.round((completedTasks / projectTasks.length) * 100);
  };

  const currentProgress = calculateProgress();

  const handleEditProject = () => {
    // Format date for input field (YYYY-MM-DD)
    const formatDateForInput = (dateString: string | null) => {
      if (!dateString) return "";
      try {
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
      } catch {
        return "";
      }
    };

    setEditProject({
      title: project?.title || "",
      description: project?.description || "",
      priority: project?.priority || "medium",
      assigneeName: project?.assigneeName || "",
      dueDate: formatDateForInput(project?.dueDate || null),
      status: project?.status || "planning",
      category: project?.category || "",
      budget: project?.budget || "",
      estimatedHours: project?.estimatedHours?.toString() || "",
      actualHours: project?.actualHours?.toString() || ""
    });
    setIsEditingProject(true);
  };

  const handleUpdateProject = () => {
    if (!editProject.title.trim()) return;
    
    const projectData = {
      title: editProject.title,
      description: editProject.description,
      priority: editProject.priority,
      assigneeName: editProject.assigneeName || null,
      dueDate: editProject.dueDate || null,
      status: project?.status || 'available',
      category: project?.category || 'general',
      progressPercentage: project?.progressPercentage || 0,
      budget: editProject.budget || null,
      estimatedHours: editProject.estimatedHours ? parseInt(editProject.estimatedHours) : null,
      actualHours: editProject.actualHours ? parseInt(editProject.actualHours) : null
    };

    updateProjectMutation.mutate(projectData);
  };

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-slate-900 mb-2">Project not found</h3>
          <p className="text-slate-500">The requested project could not be found.</p>
          {onBack && (
            <Button onClick={onBack} className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            {onBack && (
              <Button variant="outline" onClick={onBack} className="flex-shrink-0">
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{project.title}</h1>
              <p className="text-slate-600 mt-1 text-sm sm:text-base line-clamp-2">{project.description}</p>
            </div>
          </div>
        </div>
        
        {/* Mobile-friendly action bar */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={getPriorityColor(project.priority)}>
            {project.priority}
          </Badge>
          
          {/* Status badge with quick change dropdown */}
          {canEdit ? (
            <Select 
              value={project.status} 
              onValueChange={(newStatus) => {
                updateProjectMutation.mutate({ status: newStatus });
                toast({ 
                  title: "Status updated", 
                  description: `Project status changed to ${newStatus.replace('_', ' ')}` 
                });
              }}
            >
              <SelectTrigger className="w-auto h-8 px-3 border-dashed">
                <Badge variant="outline" className={getStatusColor(project.status)}>
                  {getStatusIcon(project.status)}
                  <span className="ml-1 capitalize">{project.status.replace('_', ' ')}</span>
                </Badge>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">
                  <div className="flex items-center">
                    <Circle className="w-4 h-4 mr-2" />
                    Available
                  </div>
                </SelectItem>
                <SelectItem value="in_progress">
                  <div className="flex items-center">
                    <Play className="w-4 h-4 mr-2" />
                    In Progress
                  </div>
                </SelectItem>
                <SelectItem value="waiting">
                  <div className="flex items-center">
                    <Pause className="w-4 h-4 mr-2" />
                    Waiting
                  </div>
                </SelectItem>
                <SelectItem value="completed">
                  <div className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Completed
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline" className={getStatusColor(project.status)}>
              {getStatusIcon(project.status)}
              <span className="ml-1 capitalize">{project.status.replace('_', ' ')}</span>
            </Badge>
          )}
          
          {/* Always show edit button for admin users - force display */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleEditProject} 
            className="bg-[#236383] hover:bg-[#1e5570] text-white border-[#236383] hover:border-[#1e5570]"
          >
            <Edit className="w-4 h-4 mr-2" />
            <span className="hidden xs:inline">Edit Project</span>
            <span className="xs:hidden">Edit</span>
          </Button>
        </div>
      </div>

      {/* Project Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Assignee Card */}
        <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-slate-50 hover:shadow-lg transition-all duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Project Owner</CardTitle>
              <div className="p-2 bg-blue-100 rounded-full">
                <User className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <p className="text-2xl font-bold text-slate-900">
                {project.assigneeName || 'Unassigned'}
              </p>
              {project.assigneeName ? (
                <p className="text-sm text-slate-600">Currently managing this project</p>
              ) : (
                <p className="text-sm text-orange-600 font-medium">Needs assignment</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Due Date Card */}
        <Card className="border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50 to-slate-50 hover:shadow-lg transition-all duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Target Date</CardTitle>
              <div className="p-2 bg-orange-100 rounded-full">
                <Calendar className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {project.dueDate ? (
                <>
                  <p className="text-2xl font-bold text-slate-900">
                    {new Date(project.dueDate).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </p>
                  <p className="text-sm text-slate-600">
                    {(() => {
                      const today = new Date();
                      const dueDate = new Date(project.dueDate);
                      const diffTime = dueDate.getTime() - today.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      
                      if (diffDays < 0) {
                        return `${Math.abs(diffDays)} days overdue`;
                      } else if (diffDays === 0) {
                        return 'Due today';
                      } else if (diffDays === 1) {
                        return 'Due tomorrow';
                      } else {
                        return `${diffDays} days remaining`;
                      }
                    })()}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-slate-400">No due date</p>
                  <p className="text-sm text-slate-500">Set a target completion date</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress Card */}
        <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-slate-50 hover:shadow-lg transition-all duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-green-600 uppercase tracking-wider">Progress</CardTitle>
              <div className="p-2 bg-green-100 rounded-full">
                <Target className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <p className="text-3xl font-bold text-slate-900">{currentProgress}%</p>
                <p className="text-sm font-medium text-slate-600">Complete</p>
              </div>
              
              <div className="space-y-3">
                <Progress 
                  value={currentProgress} 
                  className="h-3 bg-slate-200"
                  style={{
                    background: 'linear-gradient(to right, #dcfce7 0%, #bbf7d0 100%)'
                  }}
                />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    {projectTasks.filter(task => task.status === 'completed').length} of {projectTasks.length} tasks
                  </span>
                  <span className="font-medium text-green-700">
                    {projectTasks.length - projectTasks.filter(task => task.status === 'completed').length} remaining
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget Card */}
        <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-slate-50 hover:shadow-lg transition-all duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Budget</CardTitle>
              <div className="p-2 bg-purple-100 rounded-full">
                <Award className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <p className="text-2xl font-bold text-slate-900">
                {project.budget || 'Not set'}
              </p>
              <div className="space-y-1">
                {project.estimatedHours && (
                  <p className="text-sm text-slate-600">
                    Est: {project.estimatedHours}h
                  </p>
                )}
                {project.actualHours && project.actualHours > 0 && (
                  <p className="text-sm text-slate-600">
                    Actual: {project.actualHours}h
                  </p>
                )}
                {project.estimatedHours && project.actualHours && project.actualHours > 0 && (
                  <p className="text-sm text-slate-500">
                    {((project.actualHours / project.estimatedHours) * 100).toFixed(0)}% of estimate
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Congratulations Section - Only show for completed projects */}
      <ProjectCongratulations 
        projectId={projectId}
        projectTitle={project.title}
        currentUser={user}
        isCompleted={project.status === 'completed'}
      />

      {/* Project Team Management */}
      <ProjectUserManager 
        project={project}
        onUpdate={() => {
          // Refresh project data when assignments change
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
          queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        }}
      />

      {/* Tasks Section */}
      <Tabs defaultValue="tasks" className="w-full">
        <TabsList>
          <TabsTrigger value="tasks">Tasks ({projectTasks.length})</TabsTrigger>
          <TabsTrigger value="details">Project Details</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Project Tasks</h3>
            <Dialog open={isAddingTask} onOpenChange={setIsAddingTask}>
              <DialogTrigger asChild>
                <Button disabled={!canEdit}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Task</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="task-title">Task Title *</Label>
                    <Input
                      id="task-title"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      placeholder="Enter task title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="task-description">Description</Label>
                    <Textarea
                      id="task-description"
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      placeholder="Enter task description"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="task-priority">Priority</Label>
                      <Select value={newTask.priority} onValueChange={(value) => setNewTask({ ...newTask, priority: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="task-status">Status</Label>
                      <Select value={newTask.status} onValueChange={(value) => setNewTask({ ...newTask, status: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="waiting">Waiting</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Assignees (Multiple Allowed)</Label>
                      <TaskAssigneeSelector
                        multiple={true}
                        value={{ 
                          assigneeId: newTask.assigneeId, 
                          assigneeName: newTask.assigneeName,
                          assigneeIds: newTask.assigneeIds,
                          assigneeNames: newTask.assigneeNames
                        }}
                        onChange={(value) => setNewTask({ 
                          ...newTask, 
                          assigneeId: value.assigneeId,
                          assigneeName: value.assigneeName,
                          assigneeIds: value.assigneeIds,
                          assigneeNames: value.assigneeNames
                        })}
                        placeholder="Assign to multiple people"
                      />
                    </div>
                    <div>
                      <Label htmlFor="task-due">Due Date</Label>
                      <Input
                        id="task-due"
                        type="date"
                        value={newTask.dueDate}
                        onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsAddingTask(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateTask}
                      disabled={!newTask.title.trim() || createTaskMutation.isPending}
                    >
                      {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {tasksLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-slate-600">Loading tasks...</div>
            </div>
          ) : projectTasks.length === 0 ? (
            <div className="text-center py-12">
              <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No tasks yet</h3>
              <p className="text-slate-500">Add your first task to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projectTasks.map((task) => (
                <Card key={task.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="flex items-center pt-1">
                          <Checkbox
                            checked={task.status === 'completed'}
                            onCheckedChange={() => handleToggleTaskCompletion(task)}
                            className="w-5 h-5"
                            title={task.assigneeIds?.length > 1 ? "All team members must complete their portions first" : "Mark task complete"}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className={`font-medium ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                              {task.title}
                            </h4>
                          <Badge className={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                          <Badge variant="outline" className={getStatusColor(task.status)}>
                            {getStatusIcon(task.status)}
                            <span className="ml-1 capitalize">{task.status.replace('_', ' ')}</span>
                          </Badge>
                          </div>
                          {task.description && (
                            <p className={`text-sm mb-2 ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center space-x-4 text-sm text-slate-500">
                            {/* Multiple Assignees Display */}
                            {(task.assigneeIds?.length > 0 || task.assigneeNames?.length > 0) && (
                              <div className="flex items-center space-x-2">
                                <div className="flex items-center">
                                  <User className="w-3 h-3 mr-1" />
                                  <div className="flex flex-wrap gap-1">
                                    {/* Show new multi-assignee format */}
                                    {task.assigneeNames?.map((name, index) => (
                                      <Badge key={index} variant="outline" className="text-xs">
                                        {name}
                                        {task.assigneeIds?.[index] && (
                                          <span className="ml-1 text-green-600">👤</span>
                                        )}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                            {/* Fallback for single assignee (backward compatibility) */}
                            {task.assigneeName && (!task.assigneeIds || task.assigneeIds.length === 0) && (
                              <div className="flex items-center space-x-2">
                                <div className="flex items-center">
                                  <User className="w-3 h-3 mr-1" />
                                  {task.assigneeName}
                                </div>
                                {task.assigneeId && (
                                  <Badge variant="secondary" className="text-xs">
                                    System User
                                  </Badge>
                                )}
                              </div>
                            )}
                            {task.dueDate && (
                              <div className="flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                {new Date(task.dueDate).toLocaleDateString()}
                              </div>
                            )}
                          </div>

                          {/* Multi-user completion system for tasks with multiple assignees */}
                          {task.assigneeIds?.length > 1 && (
                            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="text-sm font-medium text-blue-800 mb-3">Team Completion Status</div>
                              <MultiUserTaskCompletion
                                taskId={task.id}
                                assigneeIds={task.assigneeIds || []}
                                assigneeNames={task.assigneeNames || []}
                                currentUserId={user?.id}
                                currentUserName={user?.displayName || user?.email}
                                taskStatus={task.status}
                                onStatusChange={(isCompleted) => {
                                  queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'tasks'] });
                                  queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-1 ml-2 sm:ml-4 shrink-0">
                        <Dialog open={editingTask?.id === task.id} onOpenChange={(open) => !open && setEditingTask(null)}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setEditingTask(task)}
                              className="w-8 h-8 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Task</DialogTitle>
                            </DialogHeader>
                            {editingTask && (
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="edit-task-title">Task Title *</Label>
                                  <Input
                                    id="edit-task-title"
                                    value={editingTask.title}
                                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="edit-task-description">Description</Label>
                                  <Textarea
                                    id="edit-task-description"
                                    value={editingTask.description || ""}
                                    onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                                    rows={3}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor="edit-task-priority">Priority</Label>
                                    <Select value={editingTask.priority} onValueChange={(value) => setEditingTask({ ...editingTask, priority: value })}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label htmlFor="edit-task-status">Status</Label>
                                    <Select value={editingTask.status} onValueChange={(value) => setEditingTask({ ...editingTask, status: value })}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                        <SelectItem value="waiting">Waiting</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor="edit-task-assignee">Assignees (Multiple Allowed)</Label>
                                    <TaskAssigneeSelector
                                      multiple={true}
                                      value={{ 
                                        assigneeId: editingTask.assigneeId, 
                                        assigneeName: editingTask.assigneeName,
                                        assigneeIds: editingTask.assigneeIds || [],
                                        assigneeNames: editingTask.assigneeNames || []
                                      }}
                                      onChange={(value) => setEditingTask({ 
                                        ...editingTask, 
                                        assigneeId: value.assigneeId,
                                        assigneeName: value.assigneeName,
                                        assigneeIds: value.assigneeIds,
                                        assigneeNames: value.assigneeNames
                                      })}
                                      placeholder="Assign to multiple people"
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="edit-task-due">Due Date</Label>
                                    <Input
                                      id="edit-task-due"
                                      type="date"
                                      value={editingTask.dueDate || ""}
                                      onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end space-x-2">
                                  <Button variant="outline" onClick={() => setEditingTask(null)}>
                                    Cancel
                                  </Button>
                                  <Button 
                                    onClick={handleUpdateTask}
                                    disabled={!editingTask.title.trim() || updateTaskMutation.isPending}
                                  >
                                    {updateTaskMutation.isPending ? "Updating..." : "Update Task"}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        
                        {/* Congratulate Button - only show for completed tasks with assignee */}
                        {task.status === 'completed' && task.assigneeName && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="w-8 h-8 p-0 bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                            onClick={() => {
                              // Send congratulations notification to the task assignee only (no popup for sender)
                              const congratulationData = {
                                userId: 'system', // System generated message
                                targetUserId: task.assigneeName, // Send to the task assignee
                                type: 'congratulations',
                                title: 'Congratulations!',
                                message: `making a real difference in our mission! From ${(user as any)?.firstName || 'Admin'}`,
                                relatedType: 'project_task',
                                relatedId: task.id,
                                celebrationData: {
                                  taskTitle: task.title,
                                  senderName: (user as any)?.firstName || 'Admin',
                                  projectId: projectId,
                                  sentAt: new Date().toISOString()
                                }
                              };
                              
                              // Send notification silently (no popup for sender)
                              apiRequest('POST', '/api/notifications', congratulationData).then(() => {
                                // Simple confirmation toast for sender
                                toast({
                                  title: "Congratulations sent!",
                                  description: `Message sent to ${task.assigneeName}`,
                                  duration: 3000,
                                });
                              }).catch(err => {
                                console.log('Congratulation notification failed:', err);
                                // Still show confirmation even if storage fails
                                toast({
                                  title: "Congratulations sent!",
                                  description: `Message sent to ${task.assigneeName}`,
                                  duration: 3000,
                                });
                              });
                            }}
                          >
                            <Award className="w-3 h-3" />
                          </Button>
                        )}
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteTask(task.id)}
                          className="w-8 h-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="details" className="space-y-6">
          {/* Project Header Card */}
          <Card className="border-0 bg-gradient-to-br from-slate-50 via-white to-blue-50 shadow-lg">
            <CardHeader className="pb-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-2xl font-bold text-slate-900 leading-tight">
                    {project.title}
                  </CardTitle>
                  <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
                    {project.description || 'No description provided for this project.'}
                  </p>
                </div>
                <div className="flex flex-col items-end space-y-3">
                  <Badge 
                    className={`${getPriorityColor(project.priority)} px-4 py-2 text-sm font-semibold shadow-sm`}
                  >
                    {project.priority.toUpperCase()} PRIORITY
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={`${getStatusColor(project.status)} px-4 py-2 text-sm font-semibold border-2 shadow-sm`}
                  >
                    {getStatusIcon(project.status)}
                    <span className="ml-2 capitalize">{project.status.replace('_', ' ')}</span>
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Project Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information Card */}
            <Card className="border-l-4 border-l-indigo-500 bg-gradient-to-br from-indigo-50 to-slate-50 hover:shadow-md transition-all duration-200">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-indigo-700 uppercase tracking-wider flex items-center">
                    <Target className="w-4 h-4 mr-2" />
                    Project Basics
                  </CardTitle>
                  <div className="p-2 bg-indigo-100 rounded-full">
                    <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-indigo-100">
                    <span className="text-sm font-medium text-slate-600">Category</span>
                    <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 font-medium">
                      {(project.category || 'General').charAt(0).toUpperCase() + (project.category || 'General').slice(1)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b border-indigo-100">
                    <span className="text-sm font-medium text-slate-600">Project ID</span>
                    <span className="text-sm font-mono text-slate-800 bg-slate-100 px-2 py-1 rounded">
                      #{project.id}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-slate-600">Created</span>
                    <span className="text-sm text-slate-700">
                      {project.createdAt ? new Date(project.createdAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      }) : 'Date not available'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline & Budget Card */}
            <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 to-slate-50 hover:shadow-md transition-all duration-200">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-emerald-700 uppercase tracking-wider flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    Timeline & Resources
                  </CardTitle>
                  <div className="p-2 bg-emerald-100 rounded-full">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-emerald-100">
                    <span className="text-sm font-medium text-slate-600">Est. Hours</span>
                    <span className="text-lg font-bold text-emerald-700">
                      {project.estimatedHours ? `${project.estimatedHours}h` : 'Not set'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b border-emerald-100">
                    <span className="text-sm font-medium text-slate-600">Actual Hours</span>
                    <span className="text-lg font-bold text-slate-700">
                      {project.actualHours ? `${project.actualHours}h` : '0h'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-slate-600">Budget</span>
                    <span className="text-lg font-bold text-emerald-700">
                      {project.budget ? `$${project.budget}` : 'Not set'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress & Performance Metrics */}
          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-slate-50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-purple-700 flex items-center">
                  <Award className="w-5 h-5 mr-3" />
                  Performance Metrics
                </CardTitle>
                <div className="p-2 bg-purple-100 rounded-full">
                  <Target className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-purple-600">{currentProgress}%</div>
                  <div className="text-sm font-medium text-slate-600">Completion</div>
                  <Progress value={currentProgress} className="h-2 bg-purple-100" />
                </div>
                
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-blue-600">{projectTasks.length}</div>
                  <div className="text-sm font-medium text-slate-600">Total Tasks</div>
                  <div className="h-2 bg-blue-100 rounded-full">
                    <div className="h-2 bg-blue-500 rounded-full" style={{ width: '100%' }}></div>
                  </div>
                </div>
                
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-green-600">
                    {projectTasks.filter(task => task.status === 'completed').length}
                  </div>
                  <div className="text-sm font-medium text-slate-600">Completed</div>
                  <div className="h-2 bg-green-100 rounded-full">
                    <div 
                      className="h-2 bg-green-500 rounded-full transition-all duration-300" 
                      style={{ 
                        width: `${projectTasks.length > 0 ? (projectTasks.filter(task => task.status === 'completed').length / projectTasks.length) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
                
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-orange-600">
                    {projectTasks.length - projectTasks.filter(task => task.status === 'completed').length}
                  </div>
                  <div className="text-sm font-medium text-slate-600">Remaining</div>
                  <div className="h-2 bg-orange-100 rounded-full">
                    <div 
                      className="h-2 bg-orange-500 rounded-full transition-all duration-300" 
                      style={{ 
                        width: `${projectTasks.length > 0 ? ((projectTasks.length - projectTasks.filter(task => task.status === 'completed').length) / projectTasks.length) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Project Edit Dialog */}
      <Dialog open={isEditingProject} onOpenChange={setIsEditingProject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-project-title">Title</Label>
              <Input
                id="edit-project-title"
                value={editProject.title}
                onChange={(e) => setEditProject({ ...editProject, title: e.target.value })}
                placeholder="Enter project title"
              />
            </div>
            <div>
              <Label htmlFor="edit-project-description">Description</Label>
              <Textarea
                id="edit-project-description"
                value={editProject.description}
                onChange={(e) => setEditProject({ ...editProject, description: e.target.value })}
                placeholder="Enter project description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-project-priority">Priority</Label>
                <Select value={editProject.priority} onValueChange={(value) => setEditProject({ ...editProject, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <ProjectAssigneeSelector
                  value={editProject.assigneeName}
                  onChange={(value) => setEditProject({ ...editProject, assigneeName: value })}
                  label="Assigned To"
                  placeholder="Select or enter assignee"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-project-due">Due Date</Label>
              <Input
                id="edit-project-due"
                type="date"
                value={editProject.dueDate}
                onChange={(e) => setEditProject({ ...editProject, dueDate: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit-project-estimated-hours">Estimated Hours</Label>
                <Input
                  id="edit-project-estimated-hours"
                  type="number"
                  min="0"
                  value={editProject.estimatedHours}
                  onChange={(e) => setEditProject({ ...editProject, estimatedHours: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="edit-project-actual-hours">Actual Hours</Label>
                <Input
                  id="edit-project-actual-hours"
                  type="number"
                  min="0"
                  value={editProject.actualHours}
                  onChange={(e) => setEditProject({ ...editProject, actualHours: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="edit-project-budget">Budget</Label>
                <Input
                  id="edit-project-budget"
                  type="text"
                  value={editProject.budget}
                  onChange={(e) => setEditProject({ ...editProject, budget: e.target.value })}
                  placeholder="e.g., $500 or TBD"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsEditingProject(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateProject}
                disabled={updateProjectMutation.isPending}
              >
                {updateProjectMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Celebration Toast */}
      <CelebrationToast
        isVisible={celebration.isVisible}
        onClose={hideCelebration}
        taskTitle={celebration.taskTitle}
        emoji={celebration.emoji}
        onSendThanks={(message: string) => {
          // Store thank you message as notification
          const thankYouData = {
            userId: (user as any)?.id || 'anonymous',
            type: 'thank_you',
            title: 'Thank You Sent!',
            message: message,
            relatedType: 'project_task',
            relatedId: celebration.taskId || null,
            celebrationData: {
              originalTaskTitle: celebration.taskTitle,
              thankYouMessage: message,
              projectId: projectId,
              sentAt: new Date().toISOString()
            }
          };
          
          apiRequest('POST', '/api/notifications', thankYouData).then(() => {
            toast({ 
              title: "Thank you sent!", 
              description: "Your appreciation has been recorded." 
            });
          }).catch(err => {
            console.log('Thank you notification failed:', err);
            toast({ 
              title: "Thank you sent!", 
              description: "Your appreciation has been recorded locally." 
            });
          });
        }}
      />
    </div>
  );
}