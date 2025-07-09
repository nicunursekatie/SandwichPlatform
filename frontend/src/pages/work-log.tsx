import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function WorkLogPage() {
  const { user } = useAuth();
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);

  const { data: logs = [], refetch } = useQuery({
    queryKey: ["/api/work-logs"],
    queryFn: () => apiRequest("GET", "/api/work-logs"),
  });

  const createLog = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/work-logs", { description, hours, minutes });
    },
    onSuccess: () => {
      setDescription("");
      setHours(0);
      setMinutes(0);
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs"] });
    },
  });

  const deleteLog = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/work-logs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs"] });
    },
  });

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Log Your Work</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={e => {
              e.preventDefault();
              createLog.mutate();
            }}
            className="space-y-4"
          >
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe your work..."
              required
            />
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                value={hours}
                onChange={e => setHours(Number(e.target.value))}
                placeholder="Hours"
                required
              />
              <Input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={e => setMinutes(Number(e.target.value))}
                placeholder="Minutes"
                required
              />
            </div>
            <Button type="submit" disabled={createLog.isPending}>
              {createLog.isPending ? "Logging..." : "Log Work"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>My Work Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {logs.length === 0 && <li className="py-4 text-gray-500">No logs yet.</li>}
              {logs.map((log: any) => (
                <li key={log.id} className="py-4 flex justify-between items-center">
                  <div>
                    <div className="font-medium">{log.description}</div>
                    <div className="text-sm text-gray-500">
                      {log.hours}h {log.minutes}m &middot; {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {(user?.role === "super_admin" || log.userId === user?.id) && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteLog.mutate(log.id)}
                      disabled={deleteLog.isPending}
                    >
                      Delete
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 