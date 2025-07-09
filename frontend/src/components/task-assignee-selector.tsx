import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

interface TaskAssigneeSelectorProps {
  value?: {
    assigneeId?: string;
    assigneeName?: string;
    assigneeIds?: string[];
    assigneeNames?: string[];
  };
  onChange: (value: { 
    assigneeId?: string; 
    assigneeName?: string;
    assigneeIds?: string[];
    assigneeNames?: string[];
  }) => void;
  placeholder?: string;
  multiple?: boolean;
}

export function TaskAssigneeSelector({ value, onChange, placeholder = "Assign to...", multiple = false }: TaskAssigneeSelectorProps) {
  const [inputMode, setInputMode] = useState<'user' | 'text'>('user');
  const [textInput, setTextInput] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);

  // Fetch users from the system
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Initialize state with existing values
  useEffect(() => {
    if (multiple) {
      // Initialize for multi-user mode
      const ids = value?.assigneeIds || [];
      const names = value?.assigneeNames || [];
      setSelectedUsers(ids);
      setSelectedNames(names);
      
      // If we have names but no IDs, switch to text mode
      if (names.length > 0 && ids.length === 0) {
        setInputMode('text');
        setTextInput(names.join(', '));
      }
    } else {
      // Single user mode - backward compatibility
      if (value?.assigneeName && !value?.assigneeId) {
        setTextInput(value.assigneeName);
        setInputMode('text');
      }
    }
  }, [value, multiple]);

  const handleUserSelect = (userId: string) => {
    const selectedUser = users.find(u => u.id === userId);
    if (!selectedUser) return;

    const userName = `${selectedUser.firstName} ${selectedUser.lastName}`.trim() || selectedUser.email;

    if (multiple) {
      // Multi-user mode
      if (selectedUsers.includes(userId)) {
        // Remove user
        const newIds = selectedUsers.filter(id => id !== userId);
        const newNames = selectedNames.filter((_, index) => selectedUsers[index] !== userId);
        setSelectedUsers(newIds);
        setSelectedNames(newNames);
        onChange({
          assigneeIds: newIds.length > 0 ? newIds : undefined,
          assigneeNames: newNames.length > 0 ? newNames : undefined
        });
      } else {
        // Add user
        const newIds = [...selectedUsers, userId];
        const newNames = [...selectedNames, userName];
        setSelectedUsers(newIds);
        setSelectedNames(newNames);
        onChange({
          assigneeIds: newIds,
          assigneeNames: newNames
        });
      }
    } else {
      // Single user mode
      onChange({
        assigneeId: userId,
        assigneeName: userName
      });
    }
  };

  const handleTextChange = (text: string) => {
    setTextInput(text);
    if (multiple) {
      const names = text.split(',').map(name => name.trim()).filter(name => name.length > 0);
      setSelectedNames(names);
      onChange({
        assigneeIds: undefined,
        assigneeNames: names.length > 0 ? names : undefined
      });
    } else {
      onChange({
        assigneeId: undefined,
        assigneeName: text || undefined
      });
    }
  };

  const removeUser = (indexToRemove: number) => {
    if (multiple) {
      const newIds = selectedUsers.filter((_, index) => index !== indexToRemove);
      const newNames = selectedNames.filter((_, index) => index !== indexToRemove);
      setSelectedUsers(newIds);
      setSelectedNames(newNames);
      onChange({
        assigneeIds: newIds.length > 0 ? newIds : undefined,
        assigneeNames: newNames.length > 0 ? newNames : undefined
      });
    }
  };

  const handleClear = () => {
    setTextInput('');
    setSelectedUsers([]);
    setSelectedNames([]);
    if (multiple) {
      onChange({
        assigneeIds: undefined,
        assigneeNames: undefined
      });
    } else {
      onChange({
        assigneeId: undefined,
        assigneeName: undefined
      });
    }
  };

  const getDisplayValue = () => {
    if (multiple) {
      return ''; // Multi-user display handled separately
    } else {
      // Single user mode
      if (value?.assigneeId) {
        const user = users.find(u => u.id === value.assigneeId);
        return user ? `${user.firstName} ${user.lastName}`.trim() || user.email : value.assigneeName;
      }
      return value?.assigneeName || '';
    }
  };

  const displayValue = getDisplayValue();

  const getAssignedUsers = () => {
    if (multiple) {
      // Multi-user mode
      const allAssignees = [];
      
      // Add system users
      selectedUsers.forEach((userId, index) => {
        const user = users.find(u => u.id === userId);
        if (user) {
          allAssignees.push({
            id: userId,
            name: `${user.firstName} ${user.lastName}`.trim() || user.email,
            isSystemUser: true,
            index
          });
        }
      });
      
      // Add text-only names
      selectedNames.forEach((name, index) => {
        if (!selectedUsers[index]) {
          allAssignees.push({
            id: `text-${index}`,
            name,
            isSystemUser: false,
            index
          });
        }
      });
      
      return allAssignees;
    }
    return [];
  };

  const assignedUsers = getAssignedUsers();

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={inputMode === 'user' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setInputMode('user')}
          className="text-xs"
        >
          {multiple ? 'Select Users' : 'Select User'}
        </Button>
        <Button
          type="button"
          variant={inputMode === 'text' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setInputMode('text')}
          className="text-xs"
        >
          Free Text
        </Button>
        {multiple && (assignedUsers.length > 0) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="text-xs text-red-600 hover:text-red-700"
          >
            Clear All
          </Button>
        )}
      </div>

      {inputMode === 'user' ? (
        <div className="space-y-2">
          <Select
            value={multiple ? '' : (value?.assigneeId || '')}
            onValueChange={handleUserSelect}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoading ? "Loading users..." : placeholder} />
            </SelectTrigger>
            <SelectContent>
              {users
                .filter(user => user.isActive)
                .map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      {multiple && selectedUsers.includes(user.id) && (
                        <span className="text-green-600">✓</span>
                      )}
                      <span className="font-medium">
                        {`${user.firstName} ${user.lastName}`.trim() || user.email}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {user.role}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            value={textInput}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={multiple ? "Enter names separated by commas..." : "Enter assignee name..."}
          />
        </div>
      )}

      {/* Display assigned users for multi-user mode */}
      {multiple && assignedUsers.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">Assigned to:</div>
          <div className="flex flex-wrap gap-2">
            {assignedUsers.map((assignee) => (
              <Badge 
                key={assignee.id} 
                variant="outline" 
                className="flex items-center gap-1 pr-1"
              >
                {assignee.name}
                {assignee.isSystemUser && (
                  <Badge variant="secondary" className="text-xs ml-1">
                    User
                  </Badge>
                )}
                <button
                  type="button"
                  onClick={() => removeUser(assignee.index)}
                  className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Display single assignee for single-user mode */}
      {!multiple && displayValue && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            {displayValue}
            <button
              type="button"
              onClick={handleClear}
              className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
          {value?.assigneeId && (
            <Badge variant="secondary" className="text-xs">
              System User
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}