import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./use-auth";

export interface Profile {
  id: string;
  plan: string;
  free_images_left: number;
  free_chat_left: number;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles" as any)
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data as unknown as Profile;
    },
    enabled: !!user,
  });

  const decrementChat = useMutation({
    mutationFn: async () => {
      if (!profile || profile.plan !== "free") return;
      const { error } = await supabase
        .from("profiles" as any)
        .update({ free_chat_left: Math.max(0, (profile.free_chat_left || 0) - 1) } as any)
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });

  const decrementImages = useMutation({
    mutationFn: async () => {
      if (!profile || profile.plan !== "free") return;
      const { error } = await supabase
        .from("profiles" as any)
        .update({ free_images_left: Math.max(0, (profile.free_images_left || 0) - 1) } as any)
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });

  const canChat = !profile || profile.plan === "pro" || (profile.free_chat_left || 0) > 0;
  const canGenerateImage = !profile || profile.plan === "pro" || (profile.free_images_left || 0) > 0;

  return {
    profile,
    isLoading,
    canChat,
    canGenerateImage,
    decrementChat: decrementChat.mutate,
    decrementImages: decrementImages.mutate,
    isPro: profile?.plan === "pro",
  };
}
