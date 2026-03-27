import { useQuery } from "@tanstack/react-query";

export async function healthCheck(): Promise<{ status: string; timestamp: string }> {
  const response = await fetch("/api/health");
  if (!response.ok) {
    throw new Error("Health check failed");
  }
  return response.json() as Promise<{ status: string; timestamp: string }>;
}

export function useHealthCheck() {
  return useQuery({
    queryKey: ["health"],
    queryFn: healthCheck,
  });
}
