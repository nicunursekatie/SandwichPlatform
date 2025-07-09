import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Project } from "@shared/schema";

interface ProjectFormData {
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  assigneeId: number | null;
  assigneeName: string;
  dueDate: string;
  startDate: string;
  estimatedHours: string;
  actualHours: string;
  progress: number;
  notes: string;
  tags: string;
  dependencies: string;
  resources: string;
  milestones: string;
  riskAssessment: string;
  successCriteria: string;
}

interface ProjectFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProjectFormData) => void;
  initialData?: Partial<ProjectFormData>;
  isSubmitting: boolean;
  title: string;
}

export function ProjectForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData, 
  isSubmitting, 
  title 
}: ProjectFormProps) {
  const [formData, setFormData] = useState<ProjectFormData>({
    title: "",
    description: "",
    status: "available",
    priority: "medium",
    category: "general",
    assigneeId: null,
    assigneeName: "",
    dueDate: "",
    startDate: "",
    estimatedHours: "",
    actualHours: "",
    progress: 0,
    notes: "",
    tags: "",
    dependencies: "",
    resources: "",
    milestones: "",
    riskAssessment: "",
    successCriteria: "",
    ...initialData
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleInputChange = (field: keyof ProjectFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                required
              />
            </div>
            
            <div className="md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                rows={3}
              />
            </div>
            
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on-hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => handleInputChange("priority", value)}>
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
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="design">Design</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="research">Research</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="assigneeName">Assignee</Label>
              <Input
                id="assigneeName"
                value={formData.assigneeName}
                onChange={(e) => handleInputChange("assigneeName", e.target.value)}
                placeholder="Enter assignee name"
              />
            </div>
            
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange("startDate", e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => handleInputChange("dueDate", e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="estimatedHours">Estimated Hours</Label>
              <Input
                id="estimatedHours"
                type="number"
                min="0"
                value={formData.estimatedHours}
                onChange={(e) => handleInputChange("estimatedHours", e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="actualHours">Actual Hours</Label>
              <Input
                id="actualHours"
                type="number"
                min="0"
                value={formData.actualHours}
                onChange={(e) => handleInputChange("actualHours", e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="progress">Progress (%)</Label>
              <Input
                id="progress"
                type="number"
                min="0"
                max="100"
                value={formData.progress}
                onChange={(e) => handleInputChange("progress", parseInt(e.target.value) || 0)}
              />
            </div>
            
            <div>
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => handleInputChange("tags", e.target.value)}
                placeholder="comma, separated, tags"
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                rows={2}
              />
            </div>
            
            <div>
              <Label htmlFor="dependencies">Dependencies</Label>
              <Textarea
                id="dependencies"
                value={formData.dependencies}
                onChange={(e) => handleInputChange("dependencies", e.target.value)}
                rows={2}
                placeholder="List project dependencies..."
              />
            </div>
            
            <div>
              <Label htmlFor="resources">Resources</Label>
              <Textarea
                id="resources"
                value={formData.resources}
                onChange={(e) => handleInputChange("resources", e.target.value)}
                rows={2}
                placeholder="Required resources..."
              />
            </div>
            
            <div>
              <Label htmlFor="milestones">Milestones</Label>
              <Textarea
                id="milestones"
                value={formData.milestones}
                onChange={(e) => handleInputChange("milestones", e.target.value)}
                rows={2}
                placeholder="Key milestones..."
              />
            </div>
            
            <div>
              <Label htmlFor="riskAssessment">Risk Assessment</Label>
              <Textarea
                id="riskAssessment"
                value={formData.riskAssessment}
                onChange={(e) => handleInputChange("riskAssessment", e.target.value)}
                rows={2}
                placeholder="Potential risks and mitigation strategies..."
              />
            </div>
            
            <div>
              <Label htmlFor="successCriteria">Success Criteria</Label>
              <Textarea
                id="successCriteria"
                value={formData.successCriteria}
                onChange={(e) => handleInputChange("successCriteria", e.target.value)}
                rows={2}
                placeholder="How will success be measured..."
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.title.trim()}>
              {isSubmitting ? "Saving..." : "Save Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}