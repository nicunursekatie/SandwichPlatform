import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, Clock, CheckCircle, AlertCircle, FolderOpen, Edit2, Trash2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from "wouter";
import { ProjectAssigneeSelector } from '@/components/project-assignee-selector';

interface Project {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: 'low' | 'medium' | 'high';
  assigneeId?: number;
  assigneeName?: string;
  dueDate?: string;
  progressPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export default function ProjectsPage({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newProject, setNewProject] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    assignedTo: '',
    assigneeIds: [] as string[],
    dueDate: ''
  });

  // Fetch projects
  const { data: projects = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/projects'],
    staleTime: 0, // Always refetch to avoid stale data issues
  });

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: async (projectData: any) => 
      apiRequest('POST', '/api/projects', projectData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      refetch(); // Force immediate refetch
      setIsAddModalOpen(false);
      setNewProject({ title: '', description: '', priority: 'medium', assignedTo: '', assigneeIds: [], dueDate: '' });
      toast({ description: 'Project created successfully!' });
    },
    onError: (error: any) => {
      console.error('Project creation error:', error);
      toast({ description: 'Failed to create project', variant: 'destructive' });
    }
  });

  // Update project mutation  
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => 
      apiRequest('PATCH', `/api/projects/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      refetch(); // Force immediate refetch
      setEditingProject(null);
      setIsAddModalOpen(false);
      setNewProject({ title: '', description: '', priority: 'medium', assignedTo: '', assigneeIds: [], dueDate: '' });
      toast({ description: 'Project updated successfully!' });
    },
    onError: (error: any) => {
      console.error('Project update error:', error);
      toast({ description: 'Failed to update project', variant: 'destructive' });
    }
  });

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => 
      apiRequest('DELETE', `/api/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      refetch(); // Force immediate refetch
      toast({ description: 'Project deleted successfully!' });
    },
    onError: (error: any) => {
      console.error('Project delete error:', error);
      toast({ description: 'Failed to delete project', variant: 'destructive' });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const projectData = {
      title: newProject.title,
      description: newProject.description,
      priority: newProject.priority,
      assigneeName: newProject.assignedTo || null,
      assigneeNames: newProject.assignedTo || null,
      assigneeIds: JSON.stringify(newProject.assigneeIds || []),
      dueDate: newProject.dueDate || null,
      status: 'available',
      category: 'general',
      progressPercentage: 0
    };

    if (editingProject) {
      await updateMutation.mutateAsync({
        id: editingProject.id,
        ...projectData
      });
    } else {
      await createMutation.mutateAsync(projectData);
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setNewProject({
      title: project.title,
      description: project.description || '',
      priority: project.priority as 'low' | 'medium' | 'high',
      assignedTo: project.assigneeName || '',
      assigneeIds: [], // Will be parsed from project data if available
      dueDate: project.dueDate || ''
    });
    setIsAddModalOpen(true);
  };

  // Separate projects by status
  const activeProjects = projects.filter((project: any) => 
    project.status === 'active' || project.status === 'in_progress'
  );
  const availableProjects = projects.filter((project: any) => 
    project.status === 'available' || project.status === 'not_started'
  );
  const waitingProjects = projects.filter((project: any) => 
    project.status === 'waiting' || project.status === 'on_hold' || project.status === 'pending'
  );
  const completedProjects = projects.filter((project: any) => 
    project.status === 'completed' || project.status === 'finished'
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Project Management</h1>
          <p className="text-gray-600">Organize and track all team projects with interactive task management</p>
        </div>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingProject ? 'Edit Project' : 'Create New Project'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newProject.title}
                  onChange={(e) => setNewProject(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter project title"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newProject.description}
                  onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter project description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={newProject.priority} onValueChange={(value: 'low' | 'medium' | 'high') => 
                    setNewProject(prev => ({ ...prev, priority: value }))
                  }>
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
                    value={newProject.assignedTo}
                    onChange={(value, userIds) => 
                      setNewProject(prev => ({ 
                        ...prev, 
                        assignedTo: value,
                        assigneeIds: userIds || []
                      }))
                    }
                    placeholder="Select team members or enter names"
                    multiple={true}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={newProject.dueDate || ''}
                  onChange={(e) => setNewProject(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingProject(null);
                  setNewProject({ title: '', description: '', priority: 'medium', assignedTo: '', assigneeIds: [], dueDate: '' });
                }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingProject ? 'Update Project' : 'Create Project'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Active ({activeProjects.length})
          </TabsTrigger>
          <TabsTrigger value="available" className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Available ({availableProjects.length})
          </TabsTrigger>
          <TabsTrigger value="waiting" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Waiting ({waitingProjects.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Completed ({completedProjects.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          <div className="grid gap-4">
            {activeProjects.map((project: any) => (
              <Card key={project.id} className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setLocation(`/projects/${project.id}`)}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{project.title}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        project.priority === 'high' ? 'destructive' :
                        project.priority === 'medium' ? 'default' : 'secondary'
                      }>
                        {project.priority} priority
                      </Badge>
                      <Badge variant="outline">active</Badge>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(project);
                        }}
                        className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                        title="Edit project"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Are you sure you want to delete this project?')) {
                            deleteMutation.mutate(project.id);
                          }
                        }}
                        className="p-1 text-gray-500 hover:text-red-600 transition-colors ml-1"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{project.description || 'No description provided'}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {project.assigneeName || 'Unassigned'}
                    </span>
                    {project.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(project.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{project.progressPercentage || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${project.progressPercentage || 0}%` }}
                      ></div>
                    </div>
                    {project.progressPercentage > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Based on completed tasks
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {activeProjects.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No active projects. Create a new project to get started.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="available" className="mt-6">
          <div className="grid gap-4">
            {availableProjects.map((project: any) => (
              <Card key={project.id} className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{project.title}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        project.priority === 'high' ? 'destructive' :
                        project.priority === 'medium' ? 'default' : 'secondary'
                      }>
                        {project.priority} priority
                      </Badge>
                      <Badge variant="outline">available</Badge>
                      <button
                        onClick={() => handleEdit(project)}
                        className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                        title="Edit project"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{project.description || 'No description provided'}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {project.assigneeName || 'Unassigned'}
                    </span>
                    {project.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(project.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {availableProjects.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No available projects.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="waiting" className="mt-6">
          <div className="grid gap-4">
            {waitingProjects.map((project: any) => (
              <Card key={project.id} className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{project.title}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        project.priority === 'high' ? 'destructive' :
                        project.priority === 'medium' ? 'default' : 'secondary'
                      }>
                        {project.priority} priority
                      </Badge>
                      <Badge variant="outline">waiting</Badge>
                      <button
                        onClick={() => handleEdit(project)}
                        className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                        title="Edit project"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{project.description || 'No description provided'}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {project.assigneeName || 'Unassigned'}
                    </span>
                    {project.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(project.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {waitingProjects.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No waiting projects.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          <div className="grid gap-4">
            {completedProjects.map((project: any) => (
              <Card key={project.id} className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{project.title}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        project.priority === 'high' ? 'destructive' :
                        project.priority === 'medium' ? 'default' : 'secondary'
                      }>
                        {project.priority} priority
                      </Badge>
                      <Badge variant="outline">completed</Badge>
                      <button
                        onClick={() => handleEdit(project)}
                        className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                        title="Edit project"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{project.description || 'No description provided'}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {project.assigneeName || 'Unassigned'}
                    </span>
                    {project.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(project.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {completedProjects.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No completed projects.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}