import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Users, X } from "lucide-react";

interface ProjectAssigneeSelectorProps {
  value: string;
  onChange: (value: string, userIds?: string[]) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  multiple?: boolean;
}

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface SelectedUser {
  id: string;
  name: string;
}

export function ProjectAssigneeSelector({ 
  value, 
  onChange, 
  placeholder = "Enter assignee names or select users",
  label = "Assigned To",
  className,
  multiple = true
}: ProjectAssigneeSelectorProps) {
  const [mode, setMode] = useState<'text' | 'user'>('text');
  const [textValue, setTextValue] = useState(value || '');
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [pendingUserId, setPendingUserId] = useState<string>('');

  // Fetch system users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    retry: false,
  });

  // Initialize from existing value
  useEffect(() => {
    if (value && users.length > 0) {
      if (value.includes(',')) {
        // Multiple names - try to match them to users
        const nameList = value.split(',').map(n => n.trim());
        const matchedUsers: SelectedUser[] = [];
        
        nameList.forEach(name => {
          const matchedUser = users.find(user => {
            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
            return fullName === name || user.email === name;
          });
          
          if (matchedUser) {
            matchedUsers.push({
              id: matchedUser.id,
              name: `${matchedUser.firstName || ''} ${matchedUser.lastName || ''}`.trim() || matchedUser.email
            });
          } else {
            // Keep as text if no user match
            matchedUsers.push({
              id: `text_${name}`,
              name: name
            });
          }
        });
        
        setSelectedUsers(matchedUsers);
        setMode('user');
        // Update parent with the matched users
        const userNames = matchedUsers.map(u => u.name).join(', ');
        const userIds = matchedUsers.filter(u => !u.id.startsWith('text_')).map(u => u.id);
        onChange(userNames, userIds);
      } else {
        setTextValue(value);
        setMode('text');
      }
    }
  }, [users, value]);

  const handleTextChange = (newValue: string) => {
    setTextValue(newValue);
    onChange(newValue, []);
  };

  const addUser = () => {
    if (!pendingUserId) return;
    
    const user = users.find(u => u.id === pendingUserId);
    if (!user) return;

    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    const newUser: SelectedUser = {
      id: user.id,
      name: fullName
    };

    // Check if already selected
    if (selectedUsers.some(u => u.id === user.id)) {
      setPendingUserId('');
      return;
    }

    const updatedUsers = [...selectedUsers, newUser];
    setSelectedUsers(updatedUsers);
    setPendingUserId('');
    
    // Update parent with names and IDs
    const names = updatedUsers.map(u => u.name).join(', ');
    const userIds = updatedUsers.filter(u => !u.id.startsWith('text_')).map(u => u.id);
    onChange(names, userIds);
  };

  const removeUser = (userId: string) => {
    const updatedUsers = selectedUsers.filter(u => u.id !== userId);
    setSelectedUsers(updatedUsers);
    
    const names = updatedUsers.map(u => u.name).join(', ');
    const userIds = updatedUsers.filter(u => !u.id.startsWith('text_')).map(u => u.id);
    onChange(names, userIds);
  };

  const toggleMode = () => {
    const newMode = mode === 'text' ? 'user' : 'text';
    setMode(newMode);
    
    if (newMode === 'text') {
      setSelectedUsers([]);
      setPendingUserId('');
      onChange(textValue, []);
    } else {
      setTextValue('');
      onChange('', []);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <Label>{label}</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant={mode === 'text' ? 'default' : 'outline'}
            size="sm"
            onClick={toggleMode}
            className="h-6 px-2 text-xs"
          >
            Text
          </Button>
          <Button
            type="button"
            variant={mode === 'user' ? 'default' : 'outline'}
            size="sm"
            onClick={toggleMode}
            className="h-6 px-2 text-xs"
          >
            <Users className="h-3 w-3 mr-1" />
            Users
          </Button>
        </div>
      </div>

      {mode === 'text' ? (
        <Input
          value={textValue}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <div className="space-y-2">
          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <Badge key={user.id} variant="secondary" className="pr-1">
                  {user.name}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUser(user.id)}
                    className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
          
          {/* Add User Select */}
          <div className="flex gap-2">
            <Select value={pendingUserId} onValueChange={setPendingUserId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select team member to add" />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter(user => !selectedUsers.some(su => su.id === user.id))
                  .map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              onClick={addUser}
              disabled={!pendingUserId}
              size="sm"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}